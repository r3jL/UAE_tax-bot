import { z } from "zod";

// A citation must point to a real retrieved chunk. The engine validates that
// every chunkId actually exists in what was retrieved — this is what makes
// "grounded & cited, or it escalates" a structural guarantee, not a hope.
export const citationSchema = z.object({
  chunkId: z.number().int().describe("The [chunkId:N] of the source passage used"),
  articleRef: z.string().describe("Legal reference, e.g. 'Article 18(2)'"),
  sourceUrl: z.string().describe("URL of the source document, if known"),
  effectiveDate: z.string().nullable().describe("Effective date of the provision, if known"),
});

// The cited-answer contract returned for every tax question.
export const answerContract = z.object({
  status: z
    .enum(["answered", "escalate"])
    .describe("'escalate' when the provided context does not support a grounded answer"),
  answer: z.string().describe("The answer, grounded only in the provided context. Empty if escalating."),
  reasoning: z
    .string()
    .describe("Step-by-step working an expert can verify quickly. Cite chunkIds inline."),
  citations: z.array(citationSchema),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("high = settled law clearly on point; low = interpretation/uncertain"),
  flaggedPremise: z
    .string()
    .nullable()
    .describe("If the question contains an incorrect assumption, state it here. Do not agree with false premises."),
  escalationReason: z
    .string()
    .nullable()
    .describe("Why this needs F&A judgment, when status = escalate"),
});

export type AnswerContract = z.infer<typeof answerContract>;

// VAT determination output (procurement / vendor use-case, Phase 1).
export const determinationContract = z.object({
  treatment: z.enum([
    "standard_5",
    "zero_rated",
    "exempt",
    "out_of_scope",
    "reverse_charge",
    "designated_zone",
    "unknown",
  ]),
  inputVatRecoverable: z.enum(["yes", "no", "partial", "na"]),
  whatToDo: z.string().describe("Plain-language next step for non-tax staff"),
  confirmWithFA: z.boolean().describe("true routes this to the F&A review queue"),
  citations: z.array(citationSchema),
  confidence: z.enum(["high", "medium", "low"]),
});

export type DeterminationContract = z.infer<typeof determinationContract>;
