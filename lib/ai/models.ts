// Central model config. All calls route through the Vercel AI Gateway via
// plain "provider/model" strings (set AI_GATEWAY_API_KEY). Override the slugs
// with env vars if the Gateway's model list uses different identifiers.

export const REASONING_MODEL =
  process.env.REASONING_MODEL ?? "anthropic/claude-sonnet-4-6";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

// Must match the embedding model's output dimensions (text-embedding-3-small = 1536).
// Env-driven so switching embedders is a config change, not a code edit.
// NOTE: changing the embedder/dimensions requires re-running `npm run ingest`
// (and a DB migration if DATABASE_URL is set) so stored vectors match query
// vectors. Recommended upgrades for this UAE/bilingual corpus:
//   - cohere/embed-multilingual-v3.0  (1024 dims) — strong Arabic + English
//   - a self-hosted BGE-m3            (1024 dims) — multilingual, ~$0 marginal
export const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS ?? 1536,
);

// Reranker — a cheap model re-scores a wide candidate set down to the final
// top-K before answering. Biggest precision lever in retrieval. Disable with
// RERANK_ENABLED=false, or point RERANK_MODEL at any Gateway slug.
export const RERANK_MODEL =
  process.env.RERANK_MODEL ?? "anthropic/claude-haiku-4.5";

export const RERANK_ENABLED = (process.env.RERANK_ENABLED ?? "true") !== "false";

// How many candidates to over-retrieve before reranking down to topK.
export const RERANK_CANDIDATES = Number(process.env.RERANK_CANDIDATES ?? 24);
