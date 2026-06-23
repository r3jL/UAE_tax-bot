import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { embed } from "ai";
import { EMBEDDING_MODEL, RERANK_ENABLED, RERANK_CANDIDATES } from "../ai/models";
import { rerank } from "./rerank";
import { SEED_CORPUS, type SeedChunk } from "./seed";

// Unified context chunk shape used by the answer engine, regardless of source.
export interface ContextChunk {
  id: number;
  content: string;
  articleRef: string | null;
  sourceUrl: string | null;
  effectiveDate: string | null;
  instrument: string | null; // decree_law | cabinet_decision | ... | fta_guide
  docTitle: string | null;
}

// Local embedded index built by `npm run ingest` when no database is set —
// lets the bot ground on the real FTA corpus with NO database, just one key.
export interface LocalEntry {
  id: number;
  content: string;
  articleRef: string | null;
  sourceUrl: string | null;
  taxType: "VAT" | "CT" | "GEN";
  instrument: string;
  authorityRank: number; // higher = more authoritative (decree-law > guide)
  docTitle: string;
  embedding: number[];
}

export const LOCAL_INDEX_PATH = join(process.cwd(), "lib/rag/corpus-index.json");

let localIndex: LocalEntry[] | null | undefined; // undefined = not yet checked

function loadLocalIndex(): LocalEntry[] | null {
  if (localIndex !== undefined) return localIndex;
  try {
    localIndex = existsSync(LOCAL_INDEX_PATH)
      ? (JSON.parse(readFileSync(LOCAL_INDEX_PATH, "utf-8")) as LocalEntry[])
      : null;
  } catch {
    localIndex = null;
  }
  return localIndex;
}

// Which grounding source is active, for diagnostics/UI.
export function activeSource(): "database" | "local-index" | "seed" {
  if (process.env.DATABASE_URL) return "database";
  if (loadLocalIndex()?.length) return "local-index";
  return "seed";
}

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// Lexical fallback over the small hand-written seed corpus — needs no key.
function rankSeed(
  question: string,
  taxType: "CT" | "VAT" | undefined,
  topK: number,
): ContextChunk[] {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

  const pool: SeedChunk[] = taxType
    ? SEED_CORPUS.filter((c) => c.taxType === taxType || c.taxType === "GEN")
    : SEED_CORPUS;

  const scored = pool.map((c) => {
    const hay = `${c.articleRef} ${c.content}`.toLowerCase();
    const score = terms.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
    return { c, score };
  });

  const matched = scored.filter((s) => s.score > 0);
  return (matched.length ? matched : scored)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({
      id: s.c.id,
      content: s.c.content,
      articleRef: s.c.articleRef,
      sourceUrl: s.c.sourceUrl,
      effectiveDate: s.c.effectiveDate,
      instrument: null,
      docTitle: null,
    }));
}

// Semantic ranking over the local embedded index, with an authority tie-break:
// take a wider semantic shortlist, then nudge higher-authority sources up so a
// controlling Decree-Law outranks a guide that's only marginally more similar.
async function rankLocalIndex(
  index: LocalEntry[],
  question: string,
  taxType: "CT" | "VAT" | undefined,
  topK: number,
): Promise<ContextChunk[]> {
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: question });
  const pool = taxType
    ? index.filter((e) => e.taxType === taxType || e.taxType === "GEN")
    : index;

  const MAX_RANK = 6; // decree_law
  const AUTHORITY_WEIGHT = 0.03; // small: semantic relevance still dominates

  return pool
    .map((e) => {
      const sim = cosine(embedding, e.embedding);
      const score = sim + AUTHORITY_WEIGHT * (e.authorityRank / MAX_RANK);
      return { e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ e }) => ({
      id: e.id,
      content: e.content,
      articleRef: e.articleRef,
      sourceUrl: e.sourceUrl,
      effectiveDate: null,
      instrument: e.instrument,
      docTitle: e.docTitle,
    }));
}

// Returns grounded context for a question. Priority: database (pgvector) >
// local embedded index (the ingested FTA PDFs) > hand-written seed corpus.
export async function getRelevantChunks(
  question: string,
  opts: { taxType?: "CT" | "VAT"; topK?: number } = {},
): Promise<ContextChunk[]> {
  const topK = opts.topK ?? 8;
  // Over-retrieve a wider candidate set, then let the reranker pick the best
  // topK. Without reranking we just fetch topK directly (original behaviour).
  const fetchK = RERANK_ENABLED ? Math.max(topK, RERANK_CANDIDATES) : topK;

  let candidates: ContextChunk[];
  if (process.env.DATABASE_URL) {
    const { retrieve } = await import("./retrieve");
    const rows = await retrieve(question, { taxType: opts.taxType, topK: fetchK });
    candidates = rows.map((r) => ({
      id: r.id,
      content: r.content,
      articleRef: r.articleRef,
      sourceUrl: null,
      effectiveDate: null,
      instrument: null,
      docTitle: null,
    }));
  } else {
    const index = loadLocalIndex();
    candidates = index?.length
      ? await rankLocalIndex(index, question, opts.taxType, fetchK)
      : rankSeed(question, opts.taxType, fetchK);
  }

  if (RERANK_ENABLED && candidates.length > topK) {
    return rerank(question, candidates, topK);
  }
  return candidates.slice(0, topK);
}
