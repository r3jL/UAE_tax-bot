import type { SeedChunk } from "./types";
import { VAT_SEED } from "./vat";
import { CT_SEED } from "./corporate-tax";
import { COMPLIANCE_SEED } from "./compliance";
import { LEGAL_SEED } from "./legal-framework";
import { REAL_ESTATE_SEED } from "./real-estate";

export type { SeedChunk } from "./types";

// The full MVP knowledge base. Replace with officially ingested text once Neon
// + `npm run ingest` are wired (see ARCHITECTURE.md). IDs are partitioned by
// domain (VAT 100s, CT 200s, Compliance 300s, Legal 400s, Real Estate 500s).
export const SEED_CORPUS: SeedChunk[] = [
  ...VAT_SEED,
  ...CT_SEED,
  ...COMPLIANCE_SEED,
  ...LEGAL_SEED,
  ...REAL_ESTATE_SEED,
];
