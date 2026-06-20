import type { SeedChunk } from "./types";

const FTA_URL = "https://tax.gov.ae/en/default.aspx";

// Compliance — registration, filing, payment, records, penalties.
// IDs 300–399.
export const COMPLIANCE_SEED: SeedChunk[] = [
  {
    id: 300,
    category: "Compliance",
    articleRef: "Compliance — VAT return filing and payment",
    sourceUrl: FTA_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "VAT returns are filed via the FTA EmaraTax portal for each tax period (monthly or quarterly as assigned by the FTA). The return and any payment are due by the 28th day of the month following the end of the tax period. If the due date falls on a weekend/holiday, it moves to the next business day.",
  },
  {
    id: 301,
    category: "Compliance",
    articleRef: "Compliance — Corporate Tax registration and return",
    sourceUrl: FTA_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "All Taxable Persons (including Free Zone Persons) must register for Corporate Tax with the FTA and obtain a Tax Registration Number, by the deadlines set in FTA decisions. The Corporate Tax return must be filed, and any tax paid, within 9 months of the end of the relevant tax period. There are no provisional/advance CT filings.",
  },
  {
    id: 302,
    category: "Compliance",
    articleRef: "Compliance — Record keeping",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2018-01-01",
    content:
      "Accounting records and documents must be kept to enable the FTA to verify tax. For VAT and Corporate Tax, records are generally retained for 5 years after the relevant tax period. For real estate, VAT-related records must be kept for 15 years. The Tax Procedures Law governs these obligations.",
  },
  {
    id: 303,
    category: "Compliance",
    articleRef: "Compliance — Administrative penalties",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2021-06-28",
    content:
      "Administrative penalties apply for non-compliance, including: failure to register on time; late filing of returns; late payment of tax (a percentage that escalates over time); submitting an incorrect return; and failure to keep required records. Penalty amounts are set by Cabinet Decision (as amended) — confirm the current schedule before quoting specific figures.",
  },
  {
    id: 304,
    category: "Compliance",
    articleRef: "Compliance — Voluntary disclosure",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2018-01-01",
    content:
      "Where a taxable person becomes aware that a submitted return or assessment contained an error resulting in a tax difference, a Voluntary Disclosure must be filed to correct it. Filing promptly typically reduces penalties compared with errors found on FTA audit.",
  },
  {
    id: 305,
    category: "Compliance",
    articleRef: "Compliance — Tax invoice issuance timing",
    sourceUrl: FTA_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "A registered supplier must issue a tax invoice within 14 days of the date of supply. Failure to issue a compliant tax invoice on time is a compliance breach and undermines the recipient's ability to recover input tax.",
  },
];
