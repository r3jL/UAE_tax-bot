import type { SeedChunk } from "./types";

const CT_URL = "https://tax.gov.ae/en/taxes/corporate.tax.aspx";

// Corporate Tax — Federal Decree-Law No. 47 of 2022. Effective for financial
// years starting on or after 1 June 2023. IDs 200–299.
export const CT_SEED: SeedChunk[] = [
  {
    id: 200,
    category: "Corporate Tax",
    articleRef: "CT Decree-Law No. 47 of 2022 — Rates (0% / 9%)",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "Corporate Tax is charged at 0% on taxable income up to AED 375,000 and 9% on taxable income above AED 375,000, for a standard Taxable Person. A separate Domestic Minimum Top-up Tax (15%) applies to large multinational groups (see DMTT).",
  },
  {
    id: 201,
    category: "Corporate Tax",
    articleRef: "CT — Domestic Minimum Top-up Tax (DMTT, 15%)",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2025-01-01",
    content:
      "Under the OECD Pillar Two rules, a Domestic Minimum Top-up Tax of 15% applies to UAE entities of large multinational enterprise groups with consolidated global revenue of EUR 750 million or more, for financial years starting on or after 1 January 2025.",
  },
  {
    id: 202,
    category: "Corporate Tax",
    articleRef: "CT — Qualifying Free Zone Person (QFZP)",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "A Free Zone Person that is a Qualifying Free Zone Person (QFZP) is taxed at 0% on its Qualifying Income and 9% on its taxable income that is not Qualifying Income. To be a QFZP it must: maintain adequate substance in the Free Zone; derive Qualifying Income; not have elected to be subject to standard CT; meet the de minimis requirement; comply with transfer pricing; and prepare audited financial statements.",
  },
  {
    id: 203,
    category: "Corporate Tax",
    articleRef: "CT — De minimis requirement (Cabinet Decision 100 of 2023)",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "A QFZP meets the de minimis requirement if its non-qualifying Revenue does not exceed the lower of 5% of total Revenue or AED 5,000,000. Crucially, both total Revenue and non-qualifying Revenue EXCLUDE revenue attributable to a domestic or foreign Permanent Establishment and revenue attributable to immovable property located in a Free Zone — those are taxed/treated under separate rules and are not weighed in the de minimis ratio.",
  },
  {
    id: 204,
    category: "Corporate Tax",
    articleRef: "CT — Consequence of failing QFZP conditions",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "If a Free Zone Person fails to meet the de minimis requirement or any other QFZP condition in a tax period, it ceases to be a QFZP from the beginning of that tax period AND for the subsequent four tax periods (five tax periods in total). During that time all of its taxable income is subject to the standard 9% Corporate Tax.",
  },
  {
    id: 205,
    category: "Corporate Tax",
    articleRef: "CT — Exempt income: dividends and participation exemption",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "Dividends and other profit distributions received from a UAE resident juridical person are exempt from Corporate Tax. Dividends and capital gains from a Participating Interest (generally a 5%+ holding held 12 months meeting conditions) in a foreign company are also exempt under the participation exemption.",
  },
  {
    id: 206,
    category: "Corporate Tax",
    articleRef: "CT — General interest deduction limitation",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "Net interest expenditure is deductible only up to 30% of adjusted EBITDA (tax EBITDA). A safe-harbour de minimis allows net interest up to AED 12,000,000 to be deducted in full regardless of the 30% cap — so the limit is the higher of 30% of EBITDA or AED 12m. Disallowed net interest can be carried forward and deducted in the subsequent 10 tax periods.",
  },
  {
    id: 207,
    category: "Corporate Tax",
    articleRef: "CT — Small Business Relief",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "A resident Taxable Person with Revenue of AED 3,000,000 or less in the relevant and all previous tax periods may elect for Small Business Relief, under which it is treated as having no taxable income for that period. The relief is available for tax periods ending on or before 31 December 2026. It is NOT available to Qualifying Free Zone Persons or to members of large multinational groups.",
  },
  {
    id: 208,
    category: "Corporate Tax",
    articleRef: "CT — Transfer pricing and the arm's length principle",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "Transactions with Related Parties and Connected Persons must comply with the arm's length principle (OECD-aligned methods). Taxable Persons may need to file a transfer pricing disclosure with the return, and to maintain a Master File and Local File where prescribed thresholds (e.g. group revenue or entity revenue) are met.",
  },
  {
    id: 209,
    category: "Corporate Tax",
    articleRef: "CT — Tax groups",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "A resident parent and its 95%-owned resident subsidiaries may form a Tax Group treated as a single Taxable Person filing one return. A Qualifying Free Zone Person (and an exempt person) cannot be a member of a Tax Group. All members must share the same financial year and accounting standards.",
  },
  {
    id: 210,
    category: "Corporate Tax",
    articleRef: "CT — Tax losses",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "Tax losses can be carried forward indefinitely and offset against future taxable income, but the offset in any period is capped at 75% of that period's taxable income. Carry-forward is subject to ownership-continuity and same-or-similar-business conditions.",
  },
  {
    id: 211,
    category: "Corporate Tax",
    articleRef: "CT — Taxable Person and residence",
    sourceUrl: CT_URL,
    taxType: "CT",
    effectiveDate: "2023-06-01",
    content:
      "Taxable Persons include: UAE-incorporated juridical persons (resident); foreign juridical persons effectively managed and controlled in the UAE; and natural persons conducting business in the UAE with turnover above AED 1,000,000 per year. Non-residents are taxed on income attributable to a UAE Permanent Establishment or UAE-sourced income.",
  },
];
