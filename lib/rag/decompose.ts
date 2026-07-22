import { generateObject } from "ai";
import { z } from "zod";
import { DECOMPOSE_MODEL } from "../ai/models";

// Multi-part questions (exam-style scenarios, numbered sub-questions) embed
// into ONE query vector that lands in a single semantic neighborhood, so
// retrieval returns 8 near-identical chunks and misses the specific provision
// each sub-part needs. The fix: split such questions into focused sub-queries,
// retrieve per sub-query, and fuse. Decomposition uses the cheap rerank model;
// any failure falls back to single-query retrieval, so it can never make
// retrieval worse.

const decomposeSchema = z.object({
  queries: z
    .array(z.string())
    .describe(
      "2-6 short, self-contained retrieval queries, one per distinct legal topic in the question. Each phrased as a focused question about UAE tax law, not a fragment.",
    ),
});

const SYSTEM = `You split a complex UAE tax question into focused search queries for a law-retrieval system.

Rules:
- One query per DISTINCT legal topic the question touches (rate treatment, zero-rating, reverse charge, input tax recovery, blocked input tax, registration, filing/returns, penalties, ...).
- Each query must stand alone: name the tax (VAT or Corporate Tax) and the topic, e.g. "Are exports of goods from the UAE zero-rated for VAT?" — never "the second transaction".
- Drop amounts, party names and dates; keep the legal concept.
- 2 to 6 queries. If the question is really one topic, return a single rephrased query.`;

// Cheap structural check — only genuinely multi-part questions pay the extra
// decomposition call. Single-topic questions keep the original fast path.
export function isMultiPart(question: string): boolean {
  const marks = (question.match(/\?/g) ?? []).length;
  if (marks >= 2) return true;
  // Enumerations: bullet lines or "1." / "2)" lists, in a non-trivial question.
  const enumerated = /(?:^|\n)\s*(?:[-•*]|\d+[.)])\s+/m.test(question);
  if (enumerated && question.length > 200) return true;
  return question.length > 600;
}

export async function decomposeQuestion(question: string): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: DECOMPOSE_MODEL,
      schema: decomposeSchema,
      temperature: 0,
      maxOutputTokens: 3000, // reasoning models think in output tokens before the JSON
      abortSignal: AbortSignal.timeout(30_000),
      system: SYSTEM,
      prompt: `Split this question into focused retrieval queries:\n\n${question}`,
    });
    const queries = object.queries
      .map((q) => q.trim())
      .filter((q) => q.length > 8)
      .slice(0, 6);
    if (queries.length >= 2) {
      console.log(`[decompose] ${queries.length} sub-queries for multi-part question`);
      return queries;
    }
    return [];
  } catch (e) {
    console.warn("[decompose] failed, using single-query retrieval:", (e as Error).message);
    return [];
  }
}
