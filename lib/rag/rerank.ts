import { generateObject } from "ai";
import { z } from "zod";
import { RERANK_MODEL } from "../ai/models";
import type { ContextChunk } from "./context";

// LLM-based reranker. Given the question and an over-retrieved candidate set,
// a cheap model re-scores them and returns the most relevant chunkIds first.
// This is the biggest precision lever in retrieval: vector similarity alone is
// noisy, especially for exact tokens (article numbers, "QFZP", AED amounts).
//
// Fails safe: any error (or an unsupported model) falls back to the original
// vector order, so reranking can never make retrieval worse than before.

const rankSchema = z.object({
  rankedChunkIds: z
    .array(z.number().int())
    .describe(
      "chunkIds ordered most-to-least relevant for answering the question. Omit clearly irrelevant passages. Never invent ids.",
    ),
});

const SYSTEM = `You rerank retrieved passages of UAE tax law by relevance to a question.
Return chunkIds ordered most-relevant first, judging topical match and legal specificity
(a passage that directly governs the question beats one that merely mentions the topic).
Omit passages that are irrelevant. Do not invent chunkIds.`;

export async function rerank(
  question: string,
  candidates: ContextChunk[],
  topK: number,
): Promise<ContextChunk[]> {
  if (candidates.length <= topK) return candidates;

  try {
    const list = candidates
      .map(
        (c) =>
          `[chunkId:${c.id}] ${c.articleRef ?? "no ref"}\n${c.content.slice(0, 600)}`,
      )
      .join("\n\n---\n\n");

    const { object } = await generateObject({
      model: RERANK_MODEL,
      schema: rankSchema,
      temperature: 0,
      system: SYSTEM,
      prompt: `Question: ${question}\n\nCandidate passages:\n\n${list}\n\nReturn the relevant chunkIds, best first.`,
    });

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const ranked: ContextChunk[] = [];
    const seen = new Set<number>();
    for (const id of object.rankedChunkIds) {
      const c = byId.get(id);
      if (c && !seen.has(id)) {
        ranked.push(c);
        seen.add(id);
      }
    }
    // Backfill anything the model dropped (original order) so we never return
    // fewer than topK while candidates remain.
    for (const c of candidates) {
      if (!seen.has(c.id)) ranked.push(c);
    }
    return ranked.slice(0, topK);
  } catch (e) {
    console.warn("[rerank] failed, using vector order:", (e as Error).message);
    return candidates.slice(0, topK);
  }
}
