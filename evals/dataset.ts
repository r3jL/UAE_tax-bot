// F&A eval set — the benchmark that turns "is it accurate?" into a measured
// number, so every later change (model, embedder, reranker) is an A/B you can
// score instead of a guess.
//
// THESE ARE SEED CASES ONLY. Expand to ~20–30 real questions with F&A, each
// with its correct cited answer. Run with `npm run eval`.

export interface EvalCase {
  id: string;
  question: string;
  taxType?: "CT" | "VAT";
  expectStatus?: "answered" | "escalate";
  // At least one of these substrings should appear in the answer, reasoning, or
  // a citation's articleRef (case-insensitive). Kept loose to avoid brittleness.
  expectMentions?: string[];
  note?: string;
}

export const EVAL_SET: EvalCase[] = [
  {
    id: "vat-registration-threshold",
    question: "What is the mandatory VAT registration threshold in the UAE?",
    taxType: "VAT",
    expectStatus: "answered",
    expectMentions: ["375,000", "375000"],
  },
  {
    id: "input-tax-on-exempt",
    question: "Can I recover input VAT incurred on making exempt supplies?",
    taxType: "VAT",
    expectStatus: "answered",
    expectMentions: ["not recoverable", "cannot", "exempt"],
  },
  {
    id: "reverse-charge-imported-services",
    question:
      "We bought consulting services from a supplier outside the UAE. How is the VAT handled?",
    taxType: "VAT",
    expectStatus: "answered",
    expectMentions: ["reverse charge"],
  },
  {
    id: "residential-first-supply",
    question:
      "Is the first supply of a newly constructed residential building zero-rated for VAT?",
    taxType: "VAT",
    expectStatus: "answered",
    expectMentions: ["zero", "residential"],
  },
  {
    id: "ct-free-zone-qfzp",
    question:
      "What makes a Free Zone company a Qualifying Free Zone Person eligible for 0% corporate tax?",
    taxType: "CT",
    expectStatus: "answered",
    expectMentions: ["qualifying", "free zone"],
  },
  {
    id: "false-premise-personal-income-tax",
    question: "What is the personal income tax rate on my salary in the UAE?",
    expectStatus: "escalate",
    note: "The UAE levies no personal income tax on salaries — the bot should flag the false premise or escalate, not invent a rate.",
  },
];
