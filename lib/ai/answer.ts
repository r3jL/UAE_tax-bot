import { generateObject } from "ai";
import { REASONING_MODEL } from "./models";
import { answerContract, type AnswerContract } from "./contracts";
import { getRelevantChunks } from "../rag/context";
import { db } from "../db";
import { queryLog } from "../db/schema";

const SYSTEM_PROMPT = `You are Lex, a friendly UAE tax assistant for Sobha's finance team. You help with UAE Corporate Tax and VAT.

TONE: Write like a helpful, knowledgeable colleague — warm, clear and conversational, in plain language a non-tax person can follow. Lead with the direct answer, then briefly explain why. Be personable and concise; keep the rigour, drop the legalese.

FORMAT: The answer is rendered as markdown — use it where it aids clarity (**bold** for key terms, bullet or numbered lists for steps, and a markdown table when comparing options, rates, or treatments). Don't overformat short answers.

NON-NEGOTIABLE RULES:
1. Answer ONLY from the provided context passages. Each passage is tagged [chunkId:N] for your reference.
2. Ground every claim in a source. Put the source's chunkId in the "citations" array — that is how the system verifies you. But in the "answer" and "reasoning" TEXT, refer to sources by their article or law name (e.g. "Article 18 of the Corporate Tax Law"), NEVER as "[chunkId:N]" — those tags are internal and must not appear in what the user reads.
3. If the context does not contain enough to answer, set status="escalate" and explain warmly, in plain language, what's missing in escalationReason. NEVER guess or use outside knowledge to fill gaps.
4. You are DECISION-SUPPORT, not authority. A human reviews your output — it's fine to say so.
5. Resist false premises. If the question assumes something incorrect, gently point it out in flaggedPremise instead of agreeing.
6. Set confidence honestly: "high" only when settled law is clearly on point; "low" for interpretation or unsettled areas.
7. In "reasoning", give a short, plain-language explanation a finance colleague can follow — not a legal brief. For multi-part questions, address each part. Reference provisions by name, not chunkId.
8. Sources carry a "type" showing legal authority. When passages conflict, the controlling order is: decree_law > cabinet_decision > ministerial_decision > fta_decision > public_clarification / fta_guide. Rely on the higher-authority provision and cite it; a guide or clarification may support the explanation, not override the rule.

ATTACHED DOCUMENTS: The user may upload their own document(s) — a contract, invoice, tax notice, etc. When present, their text appears under "ATTACHED DOCUMENT(S)" in the context. Use them to answer questions about their specifics, and apply the UAE tax provisions to them. You may quote the attached document directly. Ground any conclusion about the LAW in the provided provisions and cite their chunkId; facts that come only from the attached document don't need a chunkId. If a document is attached but unreadable or irrelevant to the question, say so plainly.

You serve a real-estate group, so VAT on real estate (residential vs commercial, first vs subsequent supply) and Corporate Tax (Free Zone / QFZP, thresholds) come up a lot.`;

export async function answerQuestion(
  question: string,
  opts: {
    taxType?: "CT" | "VAT";
    attachedDocs?: { name: string; text: string }[];
    // Identity, so an escalation can be routed back to the asker's session.
    username?: string | null;
    sessionId?: number | null;
  } = {},
): Promise<AnswerContract & { retrievedChunkIds: number[]; queryLogId?: number }> {
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

  // The user's own uploaded files (contract, invoice, notice…) as extra context.
  const attached = opts.attachedDocs ?? [];
  const attachedSection = attached.length
    ? `\n\nATTACHED DOCUMENT(S) the user uploaded:\n\n${attached
        .map((d) => `=== ${d.name} ===\n${d.text}`)
        .join("\n\n---\n\n")}`
    : "";

  // Reasoning models (gpt-oss) occasionally emit malformed JSON, and routed
  // providers vary — so retry a few times within one deadline before failing.
  const deadline = AbortSignal.timeout(120_000);
  let object: AnswerContract | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3 && !object && !deadline.aborted; attempt++) {
    try {
      ({ object } = await generateObject({
        model: REASONING_MODEL,
        schema: answerContract,
        temperature: 0, // deterministic, auditable answers for the same question
        // Headroom for reasoning models (gpt-oss "thinks" in output tokens before
        // the JSON); non-reasoning models stop early, so this is just a ceiling.
        maxOutputTokens: 2500,
        abortSignal: deadline,
        system: {
          role: "system",
          content: SYSTEM_PROMPT,
          // Cache the (fixed) system prompt so repeat calls within the cache TTL
          // don't re-bill it. Harmlessly ignored by providers that don't support it.
          providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
        },
        prompt: `Context (retrieved UAE tax provisions):\n\n${
          context || "(no passages retrieved)"
        }${attachedSection}\n\nQuestion: ${question}`,
      }));
    } catch (e) {
      lastErr = e;
    }
  }
  if (!object) throw lastErr;

  // Structural citation guard: drop any citation that doesn't map to a real
  // retrieved chunk, and force escalation if an "answered" response has none.
  const validIds = new Set(chunks.map((c) => c.id));
  const citations = object.citations.filter((c) => validIds.has(c.chunkId));
  const result: AnswerContract = { ...object, citations };

  // Normally an answered response with no grounded citation is forced to
  // escalate. But when the user attached documents, the answer may legitimately
  // be grounded in those (e.g. "your contract says…") with no corpus citation,
  // so we don't force escalation in that case.
  if (result.status === "answered" && citations.length === 0 && attached.length === 0) {
    result.status = "escalate";
    result.escalationReason =
      result.escalationReason ??
      "No answer could be grounded in the source corpus. Routed to F&A.";
    result.answer = "";
  }

  const retrievedChunkIds = chunks.map((c) => c.id);

  // Best-effort audit log; never block the response on a logging failure.
  let queryLogId: number | undefined;
  try {
    const [row] = await db
      .insert(queryLog)
      .values({
        question,
        answer: result.answer,
        status: result.status,
        confidence: result.confidence,
        taxType: opts.taxType ?? null,
        // Only escalations carry a reason; answered rows store null. This is what
        // the Review Queue shows reviewers, so persist it alongside the question.
        escalationReason:
          result.status === "escalate" ? result.escalationReason ?? null : null,
        retrievedChunkIds,
        citations: result.citations,
        // Route-back identity: an escalation is only actionable in the Review
        // Queue when it carries a username + session to return the answer to.
        username: opts.username ?? null,
        sessionId: opts.sessionId ?? null,
      })
      .returning({ id: queryLog.id });
    queryLogId = row?.id;
  } catch (e) {
    console.warn("[answer] query_log insert failed:", (e as Error).message);
  }

  return { ...result, retrievedChunkIds, queryLogId };
}
