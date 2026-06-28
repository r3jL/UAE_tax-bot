import "./load-env";
import { taxParameters, auditLog } from "../lib/db/schema";

// Seeds the versioned tax_parameters table with the current UAE values. Each
// row carries its effectiveDate and source. Idempotent: re-running inserts
// nothing new (onConflictDoNothing against the (key, jurisdiction, effectiveDate)
// unique index). To CHANGE a value later, don't edit this file — insert a new
// effective-dated row in the DB and set supersededAt on the old one.
//
// Run with `npm run db:seed-params` (after `npm run db:migrate-additive`).

const VAT = "https://tax.gov.ae/en/taxes/vat.aspx";
const CT = "https://tax.gov.ae/en/taxes/corporate.tax.aspx";
const GEN = "https://tax.gov.ae/en/legislation.aspx";

interface Seed {
  paramKey: string;
  taxType: "VAT" | "CT" | "EXCISE" | "GEN";
  kind: "rate" | "amount" | "date";
  value: number | string; // number for rate/amount; ISO date string for date
  unit: string;
  effectiveDate: string; // ISO
  sourceUrl: string;
  articleRef: string;
}

const SEED: Seed[] = [
  // --- VAT (Decree-Law 8/2017, effective 2018-01-01) ---
  { paramKey: "vat.standard_rate", taxType: "VAT", kind: "rate", value: 0.05, unit: "ratio", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "VAT Decree-Law 8/2017 — standard rate" },
  { paramKey: "vat.zero_rate", taxType: "VAT", kind: "rate", value: 0, unit: "ratio", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "VAT — zero-rated supplies" },
  { paramKey: "vat.reg.mandatory", taxType: "VAT", kind: "amount", value: 375000, unit: "AED", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "VAT registration thresholds" },
  { paramKey: "vat.reg.voluntary", taxType: "VAT", kind: "amount", value: 187500, unit: "AED", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "VAT registration thresholds" },
  { paramKey: "vat.invoice.simplified_max", taxType: "VAT", kind: "amount", value: 10000, unit: "AED", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "VAT Exec. Reg. — simplified tax invoice" },
  { paramKey: "vat.capital_asset.threshold", taxType: "VAT", kind: "amount", value: 5000000, unit: "AED", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "Capital Assets Scheme" },
  { paramKey: "vat.invoice.issue_days", taxType: "VAT", kind: "amount", value: 14, unit: "days", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "Tax invoice issuance" },
  { paramKey: "vat.return.due_days", taxType: "VAT", kind: "amount", value: 28, unit: "days", effectiveDate: "2018-01-01", sourceUrl: VAT, articleRef: "VAT return due date" },

  // --- Corporate Tax (Decree-Law 47/2022, effective 2023-06-01) ---
  { paramKey: "ct.standard_rate", taxType: "CT", kind: "rate", value: 0.09, unit: "ratio", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "CT Decree-Law 47/2022 — rates" },
  { paramKey: "ct.threshold.0pct", taxType: "CT", kind: "amount", value: 375000, unit: "AED", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "CT rates 0% / 9%" },
  { paramKey: "ct.dmtt.rate", taxType: "CT", kind: "rate", value: 0.15, unit: "ratio", effectiveDate: "2025-01-01", sourceUrl: CT, articleRef: "Domestic Minimum Top-up Tax" },
  { paramKey: "ct.dmtt.revenue_threshold_eur", taxType: "CT", kind: "amount", value: 750000000, unit: "EUR", effectiveDate: "2025-01-01", sourceUrl: CT, articleRef: "DMTT — Pillar Two threshold" },
  { paramKey: "ct.natural_person.threshold", taxType: "CT", kind: "amount", value: 1000000, unit: "AED", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "CT — natural person turnover" },
  { paramKey: "sbr.ceiling", taxType: "CT", kind: "amount", value: 3000000, unit: "AED", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "Small Business Relief — revenue ceiling" },
  { paramKey: "sbr.sunset_date", taxType: "CT", kind: "date", value: "2026-12-31", unit: "date", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "Small Business Relief — sunset" },
  { paramKey: "ct.interest.ebitda_pct", taxType: "CT", kind: "rate", value: 0.3, unit: "ratio", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "Interest limitation — 30% EBITDA" },
  { paramKey: "ct.interest.safe_harbour", taxType: "CT", kind: "amount", value: 12000000, unit: "AED", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "Interest limitation — safe harbour" },
  { paramKey: "ct.participation.min_holding", taxType: "CT", kind: "rate", value: 0.05, unit: "ratio", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "Participation exemption — holding" },
  { paramKey: "ct.deminimis.cap", taxType: "CT", kind: "amount", value: 5000000, unit: "AED", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "QFZP de minimis (CD 100/2023)" },
  { paramKey: "ct.loss.offset_cap_pct", taxType: "CT", kind: "rate", value: 0.75, unit: "ratio", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "Tax losses — offset cap" },
  { paramKey: "ct.return.due_months", taxType: "CT", kind: "amount", value: 9, unit: "months", effectiveDate: "2023-06-01", sourceUrl: CT, articleRef: "CT return due date" },

  // --- General (Tax Procedures) ---
  { paramKey: "records.retention.general_years", taxType: "GEN", kind: "amount", value: 5, unit: "years", effectiveDate: "2018-01-01", sourceUrl: GEN, articleRef: "Record keeping — general" },
  { paramKey: "records.retention.realestate_years", taxType: "GEN", kind: "amount", value: 15, unit: "years", effectiveDate: "2018-01-01", sourceUrl: GEN, articleRef: "Record keeping — real estate" },

  // --- Excise (Decree-Law 7/2017, effective 2017-10-01) ---
  { paramKey: "excise.tobacco_energy.rate", taxType: "EXCISE", kind: "rate", value: 1.0, unit: "ratio", effectiveDate: "2017-10-01", sourceUrl: GEN, articleRef: "Excise — tobacco / energy drinks" },
  { paramKey: "excise.carbonated_sweetened.rate", taxType: "EXCISE", kind: "rate", value: 0.5, unit: "ratio", effectiveDate: "2017-10-01", sourceUrl: GEN, articleRef: "Excise — carbonated / sweetened" },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const { db } = await import("../lib/db");

  const rows = SEED.map((s) => ({
    paramKey: s.paramKey,
    jurisdiction: "UAE",
    taxType: s.taxType,
    kind: s.kind,
    // numeric column takes a string; date kind stores into value_date instead.
    valueNumeric: s.kind === "date" ? null : String(s.value),
    valueDate: s.kind === "date" ? new Date(s.value as string) : null,
    unit: s.unit,
    effectiveDate: new Date(s.effectiveDate),
    sourceUrl: s.sourceUrl,
    articleRef: s.articleRef,
  }));

  const inserted = await db
    .insert(taxParameters)
    .values(rows)
    .onConflictDoNothing({
      target: [
        taxParameters.paramKey,
        taxParameters.jurisdiction,
        taxParameters.effectiveDate,
      ],
    })
    .returning({ id: taxParameters.id });

  await db.insert(auditLog).values({
    action: "seed_tax_parameters",
    detail: { attempted: rows.length, inserted: inserted.length },
  });

  console.log(
    `Seeded tax_parameters: ${inserted.length} new of ${rows.length} (existing left untouched).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
