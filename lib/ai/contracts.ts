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
  answer: z
    .string()
    .describe(
      "The answer for the user — warm, clear and conversational, like a knowledgeable colleague explaining in plain language. Grounded only in the provided context. Empty if escalating. Refer to sources by article/law name; never include internal [chunkId:N] tags.",
    ),
  reasoning: z
    .string()
    .describe(
      "A short, plain-language explanation of how you reached the answer that a finance colleague can follow. Reference provisions by article/law name, never internal chunkId tags.",
    ),
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
  explanation: z
    .string()
    .describe(
      "3-6 sentences for the user: WHY this treatment applies, citing the governing provisions BY NAME in the prose (e.g. 'Article 45(1) of the VAT Decree-Law'), and explicitly flagging anything wrong or worth checking on THIS invoice — VAT charged that doesn't match the expected rate, a missing or malformed TRN on a standard-rated UAE supply, blocked or partially-blocked items, or unusual line items. If nothing is wrong, say what was checked and found in order.",
    ),
  confirmWithFA: z.boolean().describe("true routes this to the F&A review queue"),
  citations: z.array(citationSchema),
  confidence: z.enum(["high", "medium", "low"]),
});

export type DeterminationContract = z.infer<typeof determinationContract>;

// Fields extracted from an uploaded vendor invoice (PDF text or image OCR).
// These are shown to the user to confirm/edit before the VAT determination runs.
export const invoiceFieldsContract = z.object({
  vendorName: z.string().describe("Supplier / vendor name on the invoice. '' if not found."),
  vendorCountry: z
    .string()
    .describe("Vendor's country, full name e.g. 'United Arab Emirates', 'United Kingdom'. '' if unclear."),
  vendorTRN: z
    .string()
    .nullable()
    .describe("Vendor's UAE Tax Registration Number (15 digits) if shown, else null."),
  currency: z.string().describe("Invoice currency code, e.g. 'AED', 'GBP', 'USD'. '' if unclear."),
  subtotal: z
    .string()
    .describe(
      "The invoice's NET total excluding VAT — the grand subtotal row (e.g. 'Net total (excl. VAT)'), with currency. Not a single line. '' only if the invoice shows no amounts.",
    ),
  vatAmount: z
    .string()
    .describe(
      "The TOTAL VAT charged on the whole invoice — the grand total VAT row (e.g. 'Total VAT (charged on invoice)'), as written. If only per-line VAT is shown, sum them. Use 'None' ONLY when no VAT is charged anywhere on the invoice.",
    ),
  total: z
    .string()
    .describe(
      "The invoice grand total / total payable — e.g. 'Invoice Total' or 'Total Payable', with currency. '' only if the invoice shows no amounts.",
    ),
  invoiceDate: z.string().nullable().describe("Invoice date as shown, or null."),
  description: z
    .string()
    .describe(
      "A brief summary of WHAT was supplied — the goods/services themselves, derived from the line items, e.g. 'Ready-mix concrete and concrete pump hire'. Do NOT copy invoice notes, payment terms, project references, or disclaimers.",
    ),
  lineItems: z
    .array(
      z.object({
        description: z.string().describe("What this line item covers"),
        amount: z.string().describe("Line amount as shown, with currency"),
      }),
    )
    .describe("EVERY line item / charge on the invoice — include all of them, never drop a line."),
  supplyType: z
    .enum(["goods", "services", "mixed", "unknown"])
    .describe("Whether the supply is goods, services, mixed, or unclear."),
  language: z
    .enum(["en", "ar", "mixed", "unknown"])
    .describe(
      "Primary language/script of the invoice: 'en' English only, 'ar' Arabic only, 'mixed' bilingual Arabic + English (very common in the UAE), 'unknown' if unclear.",
    ),
});

export type InvoiceFields = z.infer<typeof invoiceFieldsContract>;
