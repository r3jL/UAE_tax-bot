// Central model config.
//
// Default: every call routes through the Vercel AI Gateway via plain
// "provider/model" strings (set AI_GATEWAY_API_KEY).
//
// To offload inference elsewhere, set AI_PROVIDER (or the per-capability
// REASONING_PROVIDER / EMBEDDING_PROVIDER) to one of the OpenAI-compatible
// backends below. They all speak the OpenAI API, so a single client
// (@ai-sdk/openai-compatible) reaches them — only base URL + key differ:
//
//   ollama      LAN / self-hosted box     OLLAMA_BASE_URL, OLLAMA_API_KEY
//   openrouter  free + paid hosted models  OPENROUTER_API_KEY
//   groq        fast free tier             GROQ_API_KEY
//   google      free embeddings + Gemini   GOOGLE_API_KEY (AI Studio)
//   custom      any endpoint (vLLM, LM Studio, Together, …)
//               OPENAI_COMPATIBLE_BASE_URL, OPENAI_COMPATIBLE_API_KEY
//
// The switch is per-capability: REASONING_PROVIDER and EMBEDDING_PROVIDER each
// fall back to AI_PROVIDER. openrouter and groq are CHAT-ONLY (no embeddings
// endpoint) — if one is selected for embeddings we transparently fall back to
// the Gateway, so retrieval keeps working and you don't have to re-ingest.
// Override individual model ids with REASONING_MODEL / RERANK_MODEL /
// EMBEDDING_MODEL.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

interface Backend {
  baseURL: string;
  apiKey: string;
  embeddings: boolean; // does this backend expose /v1/embeddings?
  // Send an enforced json_schema response_format for generateObject. Needed for
  // reliable structured output on OpenRouter/Groq; harmless json-mode fallback
  // (with a warning) on models/endpoints that don't support it.
  structuredOutputs: boolean;
  // Request a specific embedding output size via the OpenAI `dimensions` param.
  // Needed for models whose native size exceeds pgvector's 2000-dim index limit
  // (e.g. gemini-embedding-001 is 3072 natively; we truncate to `dims`).
  requestDimensions?: boolean;
  // Defaults used when the matching *_MODEL env var is unset.
  reasoning: string;
  rerank: string;
  embed: string;
  dims: number;
}

const BACKENDS: Record<string, Backend> = {
  ollama: {
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    embeddings: true,
    structuredOutputs: true, // modern Ollama supports json_schema; qwen2.5 handles it
    reasoning: "qwen2.5:7b-instruct",
    rerank: "qwen2.5:7b-instruct",
    embed: "nomic-embed-text",
    dims: 768,
  },
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    embeddings: false, // chat/completions only
    structuredOutputs: true,
    // Free tier, must honor enforced json_schema. gpt-oss-20b is the most
    // reliable free option (fast, stable); larger free models like
    // nvidia/nemotron-3-super-120b-a12b:free reason better but are frequently
    // overloaded/rate-limited. Override REASONING_MODEL to switch.
    reasoning: "openai/gpt-oss-20b:free",
    rerank: "openai/gpt-oss-20b:free",
    embed: "",
    dims: 0,
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY ?? "",
    embeddings: false,
    structuredOutputs: true,
    reasoning: "llama-3.3-70b-versatile",
    rerank: "llama-3.1-8b-instant",
    embed: "",
    dims: 0,
  },
  google: {
    // Google AI Studio's OpenAI-compatible endpoint — same client, free tier.
    // Key (no card): https://aistudio.google.com/apikey
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? "",
    embeddings: true, // gemini-embedding-001, generous free quota
    structuredOutputs: true,
    // gemini-embedding-001 is 3072-dim natively; truncate to 768 (MRL) so it
    // fits pgvector's indexable limit and stays cheap to store.
    requestDimensions: true,
    reasoning: "gemini-2.0-flash",
    rerank: "gemini-2.0-flash",
    embed: "gemini-embedding-001",
    dims: 768,
  },
  custom: {
    baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? "",
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY ?? "",
    embeddings: process.env.OPENAI_COMPATIBLE_EMBEDDINGS === "true",
    structuredOutputs: process.env.OPENAI_COMPATIBLE_STRUCTURED_OUTPUTS !== "false",
    reasoning: "", // custom backends must set REASONING_MODEL etc. explicitly
    rerank: "",
    embed: "",
    dims: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
  },
};

// The Gateway path uses plain "provider/model" slugs — no backend client.
const GATEWAY = {
  reasoning: "anthropic/claude-sonnet-4-6",
  rerank: "anthropic/claude-haiku-4.5",
  embed: "openai/text-embedding-3-small",
  dims: 1536,
};

function backend(name: string): Backend {
  const b = BACKENDS[name];
  if (!b) {
    throw new Error(
      `Unknown AI provider "${name}". Set AI_PROVIDER to one of: gateway, ${Object.keys(BACKENDS).join(", ")}.`,
    );
  }
  return b;
}

// OpenRouter routes each request to one of many underlying providers. Two knobs
// we force on every request:
//  - require_parameters: only pick providers that actually honor the json_schema
//    response_format. Without it, some providers ignore it and this reasoning
//    model leaks its "thinking" into the output → structured parsing fails.
//  - sort: "throughput": prefer the fastest providers (LPU hosts like Groq), so
//    answers come back in a few seconds instead of ~20s, and retries fit the
//    deadline. Small cost bump, far better UX.
const openrouterFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      body.provider = { ...(body.provider ?? {}), require_parameters: true, sort: "throughput" };
      init = { ...init, body: JSON.stringify(body) };
    } catch {
      // not JSON — leave untouched
    }
  }
  return fetch(input, init);
};

// One client per backend, built lazily so unused backends cost nothing.
const clients = new Map<string, ReturnType<typeof createOpenAICompatible>>();
function clientFor(name: string) {
  let c = clients.get(name);
  if (!c) {
    const b = backend(name);
    c = createOpenAICompatible({
      name,
      baseURL: b.baseURL,
      apiKey: b.apiKey || "unused",
      supportsStructuredOutputs: b.structuredOutputs,
      ...(name === "openrouter" ? { fetch: openrouterFetch } : {}),
    });
    clients.set(name, c);
  }
  return c;
}

// Embeddings can target a DIFFERENT Ollama instance than chat — e.g. chat on a
// remote VM (OLLAMA_BASE_URL) while embeddings stay on the local machine that
// did the ingest (OLLAMA_EMBED_BASE_URL), so query vectors match stored ones.
function embeddingClientFor(name: string) {
  if (name === "ollama" && process.env.OLLAMA_EMBED_BASE_URL) {
    const key = "ollama-embed";
    let c = clients.get(key);
    if (!c) {
      c = createOpenAICompatible({
        name: "ollama",
        baseURL: process.env.OLLAMA_EMBED_BASE_URL,
        apiKey: process.env.OLLAMA_EMBED_API_KEY ?? process.env.OLLAMA_API_KEY ?? "ollama",
      });
      clients.set(key, c);
    }
    return c;
  }
  return clientFor(name);
}

const DEFAULT_PROVIDER = process.env.AI_PROVIDER ?? "gateway";
const reasoningProvider = process.env.REASONING_PROVIDER ?? DEFAULT_PROVIDER;
let embeddingProvider = process.env.EMBEDDING_PROVIDER ?? DEFAULT_PROVIDER;

// Chat-only backend selected for embeddings → fall back to the Gateway so a
// single AI_PROVIDER=openrouter doesn't break retrieval.
if (embeddingProvider !== "gateway" && !backend(embeddingProvider).embeddings) {
  console.warn(
    `[models] provider "${embeddingProvider}" has no embeddings endpoint — using the Vercel Gateway for embeddings. Set EMBEDDING_PROVIDER explicitly to silence this.`,
  );
  embeddingProvider = "gateway";
}

export const REASONING_MODEL =
  reasoningProvider === "gateway"
    ? process.env.REASONING_MODEL ?? GATEWAY.reasoning
    : clientFor(reasoningProvider).chatModel(
        process.env.REASONING_MODEL ?? backend(reasoningProvider).reasoning,
      );

// Must match the active embedding model's output dimensions (text-embedding-
// 3-small = 1536; Ollama nomic-embed-text = 768; Google gemini-embedding-001 =
// 768 truncated). Env-driven so switching embedders is a config change, not a
// code edit. NOTE: changing the embedder/dimensions requires re-running
// `npm run ingest` (and re-creating the DB vector column if DATABASE_URL is
// set) so stored vectors match query vectors. Default tracks the active provider.
export const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS ??
    (embeddingProvider === "gateway" ? GATEWAY.dims : backend(embeddingProvider).dims),
);

// Wrap an embedding model so every embed()/embedMany() call requests a fixed
// output size via the OpenAI `dimensions` param — without editing call sites.
function withFixedDimensions<M extends { doEmbed: (o: never) => unknown }>(
  model: M,
  dimensions: number,
): M {
  return new Proxy(model, {
    get(target, prop, receiver) {
      if (prop !== "doEmbed") return Reflect.get(target, prop, receiver);
      return (options: { providerOptions?: Record<string, unknown> }) =>
        (target.doEmbed as (o: unknown) => unknown)({
          ...options,
          providerOptions: {
            ...options.providerOptions,
            openaiCompatible: {
              dimensions,
              ...(options.providerOptions?.openaiCompatible as object),
            },
          },
        });
    },
  });
}

export const EMBEDDING_MODEL = (() => {
  if (embeddingProvider === "gateway")
    return process.env.EMBEDDING_MODEL ?? GATEWAY.embed;
  const b = backend(embeddingProvider);
  const model = embeddingClientFor(embeddingProvider).textEmbeddingModel(
    process.env.EMBEDDING_MODEL ?? b.embed,
  );
  return b.requestDimensions ? withFixedDimensions(model, EMBEDDING_DIMENSIONS) : model;
})();

// Reranker — a cheap model re-scores a wide candidate set down to the final
// top-K before answering. Biggest precision lever in retrieval. Disable with
// RERANK_ENABLED=false (recommended on rate-limited free tiers — it halves the
// LLM calls per question). Follows the reasoning provider.
export const RERANK_MODEL =
  reasoningProvider === "gateway"
    ? process.env.RERANK_MODEL ?? GATEWAY.rerank
    : clientFor(reasoningProvider).chatModel(
        process.env.RERANK_MODEL ?? backend(reasoningProvider).rerank,
      );

export const RERANK_ENABLED = (process.env.RERANK_ENABLED ?? "true") !== "false";

// How many candidates to over-retrieve before reranking down to topK.
export const RERANK_CANDIDATES = Number(process.env.RERANK_CANDIDATES ?? 24);

// Multimodal model for reading image/scanned invoices (OCR + field extraction).
// Defaults to Groq's Llama-4 Scout — keeps everything on Groq (same key, fast,
// no separate quota). Set VISION_PROVIDER=google + GOOGLE_API_KEY to use Gemini.
export function visionModel() {
  const provider = process.env.VISION_PROVIDER ?? "groq";
  if (provider === "google") {
    const key = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("Image invoices via Google need GOOGLE_API_KEY in the environment.");
    }
    return clientFor("google").chatModel(process.env.VISION_MODEL ?? "gemini-2.5-flash-lite");
  }
  if (provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Image invoices via OpenRouter need OPENROUTER_API_KEY.");
    }
    return clientFor("openrouter").chatModel(process.env.VISION_MODEL ?? "meta-llama/llama-4-scout");
  }
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "Reading image invoices needs GROQ_API_KEY (or set VISION_PROVIDER=google|openrouter).",
    );
  }
  return clientFor("groq").chatModel(
    process.env.VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct",
  );
}

// Model for invoice field extraction. Prefers Gemini (fast + reliable at
// reading dense, multi-column invoice tables); falls back to the reasoning
// model when no Google key is set.
export function extractionModel() {
  const key = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  return key
    ? clientFor("google").chatModel(process.env.VISION_MODEL ?? "gemini-2.0-flash")
    : REASONING_MODEL;
}
