import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { embed, embedMany } from "ai";
import {
  EMBEDDING_MODEL,
  RERANK_ENABLED,
  RERANK_CANDIDATES,
  HYBRID_ENABLED,
} from "../ai/models";
import { rerank } from "./rerank";
import { isMultiPart, decomposeQuestion } from "./decompose";
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
  precomputed?: number[],
): Promise<ContextChunk[]> {
  const embedding =
    precomputed ?? (await embed({ model: EMBEDDING_MODEL, value: question })).embedding;
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

interface RetrieveChunkOpts {
  taxType?: "CT" | "VAT";
  topK?: number;
  asOf?: Date;
  includeSuperseded?: boolean;
}

// One retrieval pass for one query string, over whichever grounding source is
// active: database (pgvector) > local embedded index > hand-written seed.
async function retrieveOne(
  query: string,
  opts: RetrieveChunkOpts,
  fetchK: number,
  embedding?: number[],
): Promise<ContextChunk[]> {
  if (process.env.DATABASE_URL) {
    const { retrieve, retrieveHybrid } = await import("./retrieve");
    const ropts = {
      taxType: opts.taxType,
      topK: fetchK,
      asOf: opts.asOf,
      includeSuperseded: opts.includeSuperseded,
      embedding,
    };
    const rows = HYBRID_ENABLED
      ? await retrieveHybrid(query, ropts)
      : await retrieve(query, ropts);
    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      articleRef: r.articleRef,
      sourceUrl: r.sourceUrl,
      // Carry the real effective date (ISO yyyy-mm-dd) and instrument through to
      // the answer prompt — strengthens temporal grounding, no prompt change.
      effectiveDate: r.effectiveDate
        ? r.effectiveDate.toISOString().slice(0, 10)
        : null,
      instrument: r.instrument,
      docTitle: r.docTitle,
    }));
  }
  const index = loadLocalIndex();
  return index?.length
    ? rankLocalIndex(index, query, opts.taxType, fetchK, embedding)
    : rankSeed(query, opts.taxType, fetchK);
}

// Candidates fetched per sub-query in multi-query mode. Smaller than the
// single-query pool because several lists are fused before reranking.
const MULTI_QUERY_POOL = 10;
// Cap on the fused candidate set handed to the reranker (prompt-size bound).
const MULTI_QUERY_MAX_CANDIDATES = 32;

// Returns grounded context for a question.
//
// Single-topic questions: one retrieval pass, then (optionally) rerank —
// unchanged behaviour. Multi-part questions (detected structurally, split by a
// cheap model): one retrieval pass PER sub-topic, fused with Reciprocal Rank
// Fusion, then reranked against the ORIGINAL question. This is what stops an
// 8-part scenario from retrieving 8 near-identical chunks about one sub-topic
// and escalating over "missing" law that is actually in the corpus.
export async function getRelevantChunks(
  question: string,
  opts: RetrieveChunkOpts = {},
): Promise<ContextChunk[]> {
  const topK = opts.topK ?? 8;

  // Over-retrieve a wider candidate set, then let the reranker pick the best
  // topK. Without reranking we just fetch topK directly (original behaviour).
  const fetchK = RERANK_ENABLED ? Math.max(topK, RERANK_CANDIDATES) : topK;

  // The anchor retrieval (full question) starts immediately; decomposition
  // runs concurrently, so a slow or failed decompose adds no wall-clock beyond
  // its own timeout — never serialized in front of retrieval.
  const [anchor, subQueries] = await Promise.all([
    retrieveOne(question, opts, fetchK),
    isMultiPart(question) ? decomposeQuestion(question) : Promise.resolve([]),
  ]);

  if (subQueries.length < 2) {
    if (RERANK_ENABLED && anchor.length > topK) {
      return rerank(question, anchor, topK);
    }
    return anchor.slice(0, topK);
  }

  // Multi-query: the original question's list anchors the fusion so broad
  // context still surfaces alongside each sub-topic's specific provisions.
  // All sub-query embeddings come from ONE embedMany request — separate embed
  // calls per sub-query trip the Gateway free-tier rate limit.
  let subLists: ContextChunk[][] = [];
  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: subQueries,
    });
    subLists = await Promise.all(
      subQueries.map((q, i) =>
        retrieveOne(q, opts, MULTI_QUERY_POOL, embeddings[i]).catch(() => []),
      ),
    );
  } catch (e) {
    // Batched embed failed (rate limit, outage) — the anchor list still stands.
    console.warn("[multi-query] sub-query embedding failed:", (e as Error).message);
  }
  const lists = [anchor.slice(0, MULTI_QUERY_POOL), ...subLists];

  // Reciprocal Rank Fusion across the per-query lists (same scheme as hybrid
  // retrieval): a chunk ranked well for several sub-topics beats one that is
  // merely top for a single list.
  const K = 60;
  const fused = new Map<number, { chunk: ContextChunk; score: number }>();
  for (const list of lists) {
    list.forEach((chunk, i) => {
      const inc = 1 / (K + i + 1);
      const prev = fused.get(chunk.id);
      if (prev) prev.score += inc;
      else fused.set(chunk.id, { chunk, score: inc });
    });
  }
  const candidates = [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MULTI_QUERY_MAX_CANDIDATES)
    .map((f) => f.chunk);

  // A multi-part question needs more final context than a single-topic one.
  const finalK = Math.min(12, Math.max(topK, 2 * subQueries.length));
  if (RERANK_ENABLED && candidates.length > finalK) {
    return rerank(question, candidates, finalK);
  }
  return candidates.slice(0, finalK);
}
