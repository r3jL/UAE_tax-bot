import { generateObject } from "ai";
import { REASONING_MODEL } from "./models";
import { answerContract, type AnswerContract } from "./contracts";
import { getRelevantChunks } from "../rag/context";
import { db } from "../db";
import { queryLog } from "../db/schema";

const SYSTEM_PROMPT = `You are a UAE tax assistant for Sobha's finance team. You answer questions on UAE Corporate Tax and VAT.

NON-NEGOTIABLE RULES:
1. Answer ONLY from the provided context passages. Each passage is tagged [chunkId:N].
2. Attach a citation (the chunkId + its article reference) to every claim you make.
3. If the context does not contain enough to answer, set status="escalate" and explain what is missing in escalationReason. NEVER guess or use outside knowledge to fill gaps.
4. You are DECISION-SUPPORT, not authority. A human reviews your output.
5. Resist false premises. If the question assumes something incorrect, state it in flaggedPremise instead of agreeing.
6. Set confidence honestly: "high" only when settled law is clearly on point; "low" for interpretation or unsettled areas.
7. In "reasoning", show step-by-step working an expert can verify in seconds, citing chunkIds inline. For multi-part questions, address each part.
8. Sources carry a "type" showing legal authority. When passages conflict, the controlling order is: decree_law > cabinet_decision > ministerial_decision > fta_decision > public_clarification / fta_guide. Rely on the higher-authority provision and cite it; a guide or clarification may be cited as supporting explanation, not as the overriding rule.

You serve a real-estate group, so VAT on real estate (residential vs commercial, first vs subsequent supply) and Corporate Tax (Free Zone / QFZP, thresholds) are common.`;

export async function answerQuestion(
  question: string,
  opts: { taxType?: "CT" | "VAT" } = {},
): Promise<AnswerContract & { retrievedChunkIds: number[] }> {
  const chunks = await getRelevantChunks(question, {
    taxType: opts.taxType,
    topK: 8,
  });

  const context = chunks
    .map(
      (c) =>
        `[chunkId:${c.id}] ${c.articleRef ?? "no ref"}` +
        `${c.docTitle ? ` | doc: ${c.docTitle}` : ""}` +
        `${c.instrument ? ` | type: ${c.instrument}` : ""}` +
        `${c.sourceUrl ? ` | source: ${c.sourceUrl}` : ""}` +
        `${c.effectiveDate ? ` | effective: ${c.effectiveDate}` : ""}\n${c.content}`,
    )
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: REASONING_MODEL,
    schema: answerContract,
    system: SYSTEM_PROMPT,
    prompt: `Context (retrieved UAE tax provisions):\n\n${
      context || "(no passages retrieved)"
    }\n\nQuestion: ${question}`,
  });

  // Structural citation guard: drop any citation that doesn't map to a real
  // retrieved chunk, and force escalation if an "answered" response has none.
  const validIds = new Set(chunks.map((c) => c.id));
  const citations = object.citations.filter((c) => validIds.has(c.chunkId));
  const result: AnswerContract = { ...object, citations };

  if (result.status === "answered" && citations.length === 0) {
    result.status = "escalate";
    result.escalationReason =
      result.escalationReason ??
      "No answer could be grounded in the source corpus. Routed to F&A.";
    result.answer = "";
  }

  const retrievedChunkIds = chunks.map((c) => c.id);

  // Best-effort audit log; never block the response on a logging failure.
  try {
    await db.insert(queryLog).values({
      question,
      answer: result.answer,
      status: result.status,
      confidence: result.confidence,
      retrievedChunkIds,
      citations: result.citations,
    });
  } catch (e) {
    console.warn("[answer] query_log insert failed:", (e as Error).message);
  }

  return { ...result, retrievedChunkIds };
}
