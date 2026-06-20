import type { SeedChunk } from "./types";

const VAT_URL = "https://tax.gov.ae/en/taxes/vat.aspx";

// VAT — Federal Decree-Law No. 8 of 2017 (as amended by No. 18 of 2022) and its
// Executive Regulations. Standard rate 5%, effective 1 Jan 2018. IDs 100–199.
export const VAT_SEED: SeedChunk[] = [
  {
    id: 100,
    category: "VAT",
    articleRef: "VAT Decree-Law No. 8 of 2017 — Standard rate (5%)",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "VAT is charged at the standard rate of 5% on taxable supplies of goods and services made in the UAE, unless the supply is specifically zero-rated (0%) or exempt under the Decree-Law and its Executive Regulations.",
  },
  {
    id: 101,
    category: "VAT",
    articleRef: "VAT — Mandatory and voluntary registration thresholds",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "Registration is mandatory if the value of taxable supplies and imports in the previous 12 months exceeded AED 375,000, or is expected to exceed it in the next 30 days. Voluntary registration is available at the AED 187,500 threshold (of taxable supplies/imports or taxable expenses).",
  },
  {
    id: 102,
    category: "VAT",
    articleRef: "VAT Decree-Law No. 8 of 2017, Art. 55 — Input tax recovery conditions",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "A registered taxable person may recover input tax only if: (a) the goods or services are received and used, or intended to be used, to make taxable supplies; (b) the person receives and retains a valid tax invoice for the supply; and (c) the VAT has been paid in whole or in part, or the person intends to pay it. Input tax attributable to exempt supplies is not recoverable.",
  },
  {
    id: 103,
    category: "VAT",
    articleRef: "VAT Executive Regulations, Art. 59 — Contents of a valid tax invoice",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "A valid tax invoice must contain: the words 'Tax Invoice' clearly displayed; the name, address and Tax Registration Number (TRN) of the supplier; the name, address and TRN of the recipient where registered; a sequential/unique invoice number; the date of issue (and date of supply if different); a description of the goods or services; for each line the unit price, quantity, rate of tax and amount payable in AED; the amount of any discount; the gross amount payable in AED; and the tax amount payable in AED. A simplified tax invoice (fewer particulars) is allowed where the recipient is unregistered or consideration is under AED 10,000. If a mandatory particular such as the supplier's TRN is missing, it is not a valid tax invoice and input tax cannot be recovered on it.",
  },
  {
    id: 104,
    category: "VAT",
    articleRef: "VAT Executive Regulations, Art. 53 — Non-recoverable (blocked) input tax",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "Input tax is blocked (non-recoverable) even if a valid tax invoice is held where incurred on: certain entertainment provided to anyone not employed by the person (customers, officials, shareholders); a motor vehicle purchased, leased or rented that is available for personal use; and goods or services bought for employees' personal benefit at no charge, subject to limited exceptions.",
  },
  {
    id: 105,
    category: "VAT",
    articleRef: "VAT Decree-Law No. 8 of 2017, Art. 48 — Reverse charge on imports",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "Where a taxable person imports concerned services or goods for business from a supplier with no place of establishment in the UAE, the recipient accounts for VAT under the reverse charge mechanism: it self-accounts output tax on the import and may simultaneously recover it as input tax to the extent used for taxable supplies. The overseas supplier charges no UAE VAT.",
  },
  {
    id: 106,
    category: "VAT",
    articleRef: "VAT — Zero-rated supplies",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "Zero-rated (0%) supplies are taxable supplies on which no VAT is charged but related input tax remains recoverable. They include: exports of goods/services outside the GCC implementing states; international transport; certain investment-grade precious metals; the first supply of residential buildings (within 3 years of completion); and certain education and healthcare.",
  },
  {
    id: 107,
    category: "VAT",
    articleRef: "VAT — Exempt supplies",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "Exempt supplies carry no VAT and do NOT allow recovery of related input tax. They include: certain financial services; the supply of residential buildings after the first supply; bare land; and local passenger transport. The key difference from zero-rated: exempt blocks input tax recovery, zero-rated does not.",
  },
  {
    id: 108,
    category: "VAT",
    articleRef: "VAT — Date of supply (tax point)",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "VAT is due at the earliest of: the date of issue of the tax invoice; the date payment is received; or the date of supply (delivery/completion). For contracts with periodic payments or consecutive invoices (e.g. off-plan/construction milestones), the date of supply is the earliest of the payment-due date shown on the invoice, the date of payment, or 12 months from delivery.",
  },
  {
    id: 109,
    category: "VAT",
    articleRef: "VAT — Apportionment of residual input tax",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "Where input tax relates to both taxable supplies (including zero-rated) and exempt supplies, only the portion attributable to taxable supplies is recoverable. Residual input tax that cannot be directly attributed is apportioned (normally by the recoverable-to-total supplies ratio) with an annual wash-up adjustment.",
  },
  {
    id: 110,
    category: "VAT",
    articleRef: "VAT — Designated Zones",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "A Designated Zone (specified by Cabinet Decision and fenced/controlled) is treated as outside the UAE for VAT on certain supplies of goods. Goods transferred within or between Designated Zones can be outside the scope of VAT, but services supplied in a Designated Zone are generally treated as made in the UAE and taxed normally.",
  },
  {
    id: 111,
    category: "VAT",
    articleRef: "VAT — Transfer of business as a going concern (TOGC)",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "The transfer of a business, or an independent part of a business, as a going concern to a taxable person who will continue the business is not treated as a supply for VAT (outside scope), provided the conditions are met. No VAT is charged on a qualifying TOGC.",
  },
  {
    id: 112,
    category: "VAT",
    articleRef: "VAT — Bad debt relief",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "A supplier may reduce output tax (claim bad debt relief) for VAT already accounted for on a supply where: the consideration has been written off in full or part in the accounts; more than 6 months have passed from the date of supply; and the supplier has notified the customer of the write-off.",
  },
  {
    id: 113,
    category: "VAT",
    articleRef: "VAT — Capital Assets Scheme",
    sourceUrl: VAT_URL,
    taxType: "VAT",
    effectiveDate: "2018-01-01",
    content:
      "Capital assets with a cost of AED 5,000,000 or more (excluding VAT) are monitored under the Capital Assets Scheme. Input tax recovery is adjusted over an adjustment period to reflect actual taxable use: 10 years for buildings/parts of buildings and 5 years for other capital assets.",
  },
];
