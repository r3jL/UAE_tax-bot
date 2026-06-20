// Central model config. All calls route through the Vercel AI Gateway via
// plain "provider/model" strings (set AI_GATEWAY_API_KEY). Override the slugs
// with env vars if the Gateway's model list uses different identifiers.

export const REASONING_MODEL =
  process.env.REASONING_MODEL ?? "anthropic/claude-sonnet-4-6";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

// Must match the embedding model's output dimensions. text-embedding-3-small = 1536.
export const EMBEDDING_DIMENSIONS = 1536;
