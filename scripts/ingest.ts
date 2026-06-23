import { config } from "dotenv";
// Load .env.local first (Next.js convention + what the README/.env.example use),
// then .env as a fallback. dotenv won't override vars already set.
config({ path: ".env.local" });
config();
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, extname, basename, relative } from "path";
import { embedMany } from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "../lib/db";
import { documents, lawChunks } from "../lib/db/schema";
import { chunkDocument, hashContent, type DocKind } from "../lib/rag/chunk";
import { EMBEDDING_MODEL } from "../lib/ai/models";
import { LOCAL_INDEX_PATH, type LocalEntry } from "../lib/rag/context";

// Ingestion pipeline. Auto-discovers every PDF/TXT/MD under ./corpus
// (skipping folders that start with "_"), extracts text, chunks by article,
// embeds, and stores with citation metadata. Run with `npm run ingest`.
//
// Drop a new official document into corpus/ and re-run — no manifest editing
// needed. Metadata is derived from the folder + filename; override per-file via
// corpus/manifest.json if you want exact titles/dates.

const CORPUS = join(process.cwd(), "corpus");
const SUPPORTED = new Set([".pdf", ".txt", ".md"]);
const BATCH = 64; // embeddings per request

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_") || name.startsWith(".")) continue; // skip _set-aside, hidden
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (SUPPORTED.has(extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

// Authority hierarchy — higher beats lower when sources conflict.
const AUTHORITY: Record<string, number> = {
  decree_law: 6,
  cabinet_decision: 5,
  ministerial_decision: 4,
  fta_decision: 3,
  public_clarification: 2,
  fta_guide: 2,
  reference: 1,
};

function deriveMeta(file: string) {
  const rel = relative(CORPUS, file).toLowerCase();
  const name = basename(file);

  // Instrument (legal authority type) from path + filename.
  let instrument = "reference";
  if (/decree-law/.test(rel)) instrument = "decree_law";
  else if (/ministerial-decision|md-no|md-\d/.test(rel))
    instrument = "ministerial_decision";
  else if (/cabinet-decision|cabient-decision/.test(rel))
    instrument = "cabinet_decision";
  else if (/fta-decision/.test(rel)) instrument = "fta_decision";
  else if (/public-clarification|vatp\d|ctp\d/.test(rel))
    instrument = "public_clarification";
  else if (/guide/.test(rel)) instrument = "fta_guide";
  else if (/legislation/.test(rel)) instrument = "cabinet_decision";

  const authorityRank = AUTHORITY[instrument] ?? 1;

  const kind: DocKind =
    instrument === "decree_law" ||
    instrument === "cabinet_decision" ||
    instrument === "ministerial_decision" ||
    instrument === "fta_decision"
      ? "law"
      : instrument === "public_clarification"
        ? "clarification"
        : "guide";

  // Tax type for the UI filter. VAT vs CT vs GEN (applies to both).
  let taxType: "VAT" | "CT" | "GEN" = "GEN";
  if (/ct-|corporate|ctp\d|qfzp|265|100-2023|47-2022|nexus|investment-funds/.test(rel))
    taxType = "CT";
  else if (/vat|vatp\d|value-added|decree-law-8|executive-regulation/.test(rel))
    taxType = "VAT";
  else if (/procedure|penalt|public-benefit/.test(rel)) taxType = "GEN";

  const sourceUrl =
    taxType === "CT"
      ? "https://tax.gov.ae/en/taxes/corporate.tax.aspx"
      : "https://tax.gov.ae/en/taxes/vat.aspx";

  const title = name.replace(/\.(pdf|txt|md)$/i, "").replace(/[-_]+/g, " ").trim();
  return { taxType, instrument, authorityRank, kind, sourceUrl, title };
}

async function readDocText(file: string): Promise<string> {
  if (extname(file).toLowerCase() === ".pdf") {
    const buf = new Uint8Array(readFileSync(file));
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  return readFileSync(file, "utf-8");
}

async function embedInBatches(values: string[]): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < values.length; i += BATCH) {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: values.slice(i, i + BATCH),
    });
    all.push(...embeddings);
  }
  return all;
}

async function main() {
  // Embeddings always need the key. The database is optional: with no
  // DATABASE_URL we build a local index file instead (the "keep it simple" path).
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("Ingestion needs AI_GATEWAY_API_KEY in .env.local.");
    process.exit(1);
  }
  const useDb = !!process.env.DATABASE_URL;
  console.log(
    useDb
      ? "Mode: database (Neon + pgvector)\n"
      : "Mode: local index file (no database)\n",
  );

  const files = walk(CORPUS);
  if (files.length === 0) {
    console.error("No documents found under ./corpus.");
    process.exit(1);
  }
  console.log(`Found ${files.length} document(s) to ingest.\n`);

  const localEntries: LocalEntry[] = [];
  let localId = 1000;
  let totalChunks = 0;

  for (const file of files) {
    const meta = deriveMeta(file);
    let text: string;
    try {
      text = await readDocText(file);
    } catch (e) {
      console.warn(`  skip (extract failed): ${meta.title} — ${(e as Error).message}`);
      continue;
    }

    const chunks = chunkDocument(text, meta.kind);
    if (chunks.length === 0) {
      console.warn(`  skip (no text): ${meta.title}`);
      continue;
    }
    console.log(`Ingesting "${meta.title}" — ${chunks.length} chunks`);

    const embeddings = await embedInBatches(chunks.map((c) => c.content));

    if (useDb) {
      const [doc] = await db
        .insert(documents)
        .values({
          title: meta.title,
          instrument: meta.instrument,
          taxType: meta.taxType,
          sourceUrl: meta.sourceUrl,
        })
        .returning();
      await db.insert(lawChunks).values(
        chunks.map((c, i) => ({
          documentId: doc.id,
          articleRef: c.articleRef ?? null,
          content: c.content,
          contentHash: hashContent(c.content),
          embedding: embeddings[i],
          taxType: meta.taxType,
        })),
      );
    } else {
      chunks.forEach((c, i) => {
        localEntries.push({
          id: localId++,
          content: c.content,
          articleRef: c.articleRef ?? meta.title,
          sourceUrl: meta.sourceUrl,
          taxType: meta.taxType,
          instrument: meta.instrument,
          authorityRank: meta.authorityRank,
          docTitle: meta.title,
          embedding: embeddings[i],
        });
      });
    }
    totalChunks += chunks.length;
  }

  if (!useDb) {
    writeFileSync(LOCAL_INDEX_PATH, JSON.stringify(localEntries));
    console.log(`\nWrote local index → ${LOCAL_INDEX_PATH}`);
  }

  console.log(`\nDone. Ingested ${totalChunks} chunks from ${files.length} files.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
