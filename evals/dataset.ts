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
  {
    id: "ct-computation-xyz-scenario",
    question:
      "XYZ LLC (mainland UAE, not Small Business Relief, not in a Tax Group) has accounting profit before tax of AED 4,800,000 for the period ending 31 December 2025. Depreciation expense AED 450,000 vs tax depreciation allowable AED 390,000; entertainment expenses AED 240,000; donations to an unapproved foreign charity AED 150,000; exempt dividend income from a 30% UAE shareholding AED 500,000; net interest expense AED 900,000 with EBITDA of AED 2,900,000; carried-forward tax losses AED 700,000. Calculate the taxable income and the final Corporate Tax liability.",
    taxType: "CT",
    expectStatus: "answered",
    // Deterministic calculator figures: taxable income 3,930,000 → tax 319,950.
    expectMentions: ["319,950", "319950"],
    note: "Exercises the computeCorporateTax tool: add-back signs, entertainment 50%, GIDLR safe harbour, 75% loss cap, 0%/9% bands.",
  },
  {
    id: "vat-return-computation-scenario",
    question:
      "A VAT-registered UAE trader had these Q2 figures: local taxable sales AED 1,250,000 (exclusive of VAT); exports AED 730,000; local standard-rated purchases AED 850,000 + 5% VAT (all recoverable); imports under the reverse charge mechanism AED 400,000; client entertainment AED 18,000 + 5% VAT. Calculate the total output VAT, recoverable input VAT, and net VAT payable for the return.",
    taxType: "VAT",
    expectStatus: "answered",
    // Output 62,500 + RCM 20,000 = 82,500; input 42,500 + 20,000 = 62,500 → net 20,000.
    expectMentions: ["82,500", "82500"],
    note: "Exercises the computeVatReturn tool: RCM both sides, blocked entertainment input VAT.",
  },
];
