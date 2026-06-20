import type { SeedChunk } from "./types";

const FTA_URL = "https://tax.gov.ae/en/default.aspx";

// Legal framework — how UAE tax law is structured, who administers it, and the
// weight of each source. IDs 400–499.
export const LEGAL_SEED: SeedChunk[] = [
  {
    id: 400,
    category: "Legal",
    articleRef: "Legal — The Federal Tax Authority (FTA)",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2017-01-01",
    content:
      "The Federal Tax Authority (FTA) administers, collects and enforces federal taxes in the UAE (VAT, Excise Tax and Corporate Tax). Registration, returns, payments and refunds are handled through the FTA's EmaraTax online portal.",
  },
  {
    id: 401,
    category: "Legal",
    articleRef: "Legal — Hierarchy of UAE tax law",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2017-01-01",
    content:
      "UAE tax authority flows in a hierarchy: Federal Decree-Laws (the primary legislation, e.g. CT Law 47/2022, VAT Law 8/2017) sit at the top; Cabinet Decisions and Ministerial Decisions provide binding detail and thresholds; FTA Decisions set procedural rules. FTA Guides and Public Clarifications are persuasive guidance on interpretation but are not themselves legislation — where they conflict with the law, the law prevails.",
  },
  {
    id: 402,
    category: "Legal",
    articleRef: "Legal — Tax Procedures Law",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2023-03-01",
    content:
      "Federal Decree-Law No. 28 of 2022 on Tax Procedures sets the common procedural framework across all federal taxes: registration, record-keeping, tax audits, assessments, voluntary disclosures, penalties, refunds, and the objection/appeal process (FTA reconsideration, the Tax Disputes Resolution Committee, then the courts).",
  },
  {
    id: 403,
    category: "Legal",
    articleRef: "Legal — Public Clarifications and Private Clarifications",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2018-01-01",
    content:
      "The FTA issues Public Clarifications explaining its interpretation of specific issues for all taxpayers, and can issue a Private Clarification in response to a specific taxpayer's request about their own situation. Clarifications guide treatment but do not override the Decree-Law or its Regulations.",
  },
  {
    id: 404,
    category: "Legal",
    articleRef: "Legal — Excise Tax (overview)",
    sourceUrl: FTA_URL,
    taxType: "GEN",
    effectiveDate: "2017-10-01",
    content:
      "Excise Tax (Federal Decree-Law No. 7 of 2017) applies to specific goods harmful to health/environment: tobacco products and electronic smoking devices/liquids at 100%; energy drinks at 100%; carbonated drinks at 50%; and sweetened drinks at 50%. It is generally not relevant to a real-estate group's core activity.",
  },
];
