// Shared type for the MVP seed knowledge base.
//
// ⚠️ Every entry is a CONCISE PARAPHRASE for the MVP — accurate to well-known
// UAE rules but NOT verbatim law. Replace with officially ingested text
// (npm run ingest) before any real filing decision. Each carries a reference
// and source URL so answers stay traceable.

export type Category =
  | "VAT"
  | "Corporate Tax"
  | "Compliance"
  | "Legal"
  | "Real Estate"
  | "Excise";

// taxType drives the UI filter. "GEN" = relevant to both CT and VAT (shows
// regardless of filter).
export type TaxType = "VAT" | "CT" | "GEN";

export interface SeedChunk {
  id: number;
  category: Category;
  articleRef: string;
  sourceUrl: string;
  taxType: TaxType;
  effectiveDate: string;
  content: string;
}
