import { embed } from "ai";
import { cosineDistance, sql, desc, eq, and, or, lte, isNull } from "drizzle-orm";
import { db } from "../db";
import { lawChunks, documents } from "../db/schema";
import { EMBEDDING_MODEL, HYBRID_RRF_K } from "../ai/models";

export interface RetrievedChunk {
  id: number;
  content: string;
  articleRef: string | null;
  documentId: number;
  docTitle: string | null;
  sourceUrl: string | null;
  effectiveDate: Date | null;
  instrument: string | null;
  similarity: number;
}

// Shared retrieval options. By default we return only law that is CURRENTLY in
// force: status='active' (not superseded/repealed) AND effective on/before now.
// `asOf` answers historical questions ("what did the law say on date X"); chunks
// with a null effectiveDate stay visible (graceful during metadata backfill).
export interface RetrieveOpts {
  taxType?: "CT" | "VAT";
  topK?: number;
  asOf?: Date;
  includeSuperseded?: boolean;
  jurisdiction?: string;
}

// The WHERE that enforces tax-type + lifecycle + temporal correctness. Used by
// BOTH the semantic and the lexical leg so they never disagree.
function activeFilter(opts: RetrieveOpts) {
  const clauses = [];
  if (opts.taxType) clauses.push(eq(lawChunks.taxType, opts.taxType));
  if (!opts.includeSuperseded) clauses.push(eq(lawChunks.status, "active"));
  const asOf = opts.asOf ?? new Date();
  clauses.push(or(isNull(lawChunks.effectiveDate), lte(lawChunks.effectiveDate, asOf)));
  if (opts.jurisdiction) clauses.push(eq(lawChunks.jurisdiction, opts.jurisdiction));
  return and(...clauses);
}

// Embed the query and pull the most similar law chunks (cosine similarity),
// optionally filtered to a tax type. Returns chunks with their ids so the
// answer engine can verify citations against what was actually retrieved.
export async function retrieve(
  question: string,
  opts: RetrieveOpts = {},
): Promise<RetrievedChunk[]> {
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: question });

  const similarity = sql<number>`1 - (${cosineDistance(lawChunks.embedding, embedding)})`;

  const rows = await db
    .select({
      id: lawChunks.id,
      content: lawChunks.content,
      articleRef: lawChunks.articleRef,
      documentId: lawChunks.documentId,
      docTitle: documents.title,
      sourceUrl: documents.sourceUrl,
      effectiveDate: lawChunks.effectiveDate,
      instrument: documents.instrument,
      similarity,
    })
    .from(lawChunks)
    .leftJoin(documents, eq(lawChunks.documentId, documents.id))
    .where(activeFilter(opts))
    .orderBy(desc(similarity))
    .limit(opts.topK ?? 8);

  return rows;
}

// Hybrid retrieval: run BOTH a semantic (pgvector cosine) search and a keyword
// (Postgres full-text) search, then fuse the two ranked lists with Reciprocal
// Rank Fusion. Vector search nails paraphrase/concept matches; full-text nails
// exact tokens it misses (article numbers, QFZP, "designated zone", TRNs). RRF
// (score = Σ 1/(k + rank)) needs no score normalisation and is robust.
//
// The full-text vector is computed inline (no stored column / GIN index needed),
// which keeps this a pure query change — zero schema migration. For the ~3k-row
// corpus the sequential scan is sub-second; add a generated tsvector column +
// GIN index later if the corpus grows.
export async function retrieveHybrid(
  question: string,
  opts: RetrieveOpts = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? 8;
  const pool = Math.max(topK * 2, 30); // candidates pulled from each method
  const baseFilter = activeFilter(opts);

  const fields = {
    id: lawChunks.id,
    content: lawChunks.content,
    articleRef: lawChunks.articleRef,
    documentId: lawChunks.documentId,
    docTitle: documents.title,
    sourceUrl: documents.sourceUrl,
    effectiveDate: lawChunks.effectiveDate,
    instrument: documents.instrument,
  };

  // 1. Semantic candidates (pgvector cosine).
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: question });
  const similarity = sql<number>`1 - (${cosineDistance(lawChunks.embedding, embedding)})`;
  const vecRows = await db
    .select({ ...fields, similarity })
    .from(lawChunks)
    .leftJoin(documents, eq(lawChunks.documentId, documents.id))
    .where(baseFilter)
    .orderBy(desc(similarity))
    .limit(pool);

  // 2. Keyword candidates (Postgres full-text search, tsvector built inline
  // from the article reference + content so "Article 18" and exact terms hit).
  const tsv = sql`to_tsvector('english', coalesce(${lawChunks.articleRef}, '') || ' ' || ${lawChunks.content})`;
  const tsq = sql`websearch_to_tsquery('english', ${question})`;
  const rank = sql<number>`ts_rank(${tsv}, ${tsq})`;
  const lexRows = await db
    .select({ ...fields, similarity: sql<number>`0` })
    .from(lawChunks)
    .leftJoin(documents, eq(lawChunks.documentId, documents.id))
    .where(and(baseFilter, sql`${tsv} @@ ${tsq}`))
    .orderBy(desc(rank))
    .limit(pool);

  // 3. Reciprocal Rank Fusion. First occurrence wins the row data (vector rows
  // carry the real similarity); shared chunks just accumulate more score.
  const k = HYBRID_RRF_K;
  const fused = new Map<number, { row: RetrievedChunk; score: number }>();
  const add = (rows: RetrievedChunk[]) =>
    rows.forEach((row, i) => {
      const inc = 1 / (k + i + 1);
      const prev = fused.get(row.id);
      if (prev) prev.score += inc;
      else fused.set(row.id, { row, score: inc });
    });
  add(vecRows);
  add(lexRows);

  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((f) => f.row);
}
