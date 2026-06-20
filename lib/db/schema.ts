import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  vector,
  jsonb,
  varchar,
  index,
} from "drizzle-orm/pg-core";

import { EMBEDDING_DIMENSIONS } from "../ai/models";

// Source documents — the legal instruments we ingest.
// instrument captures the legal hierarchy (Decree-Law > Cabinet > Ministerial
// > FTA Guide > Public Clarification) so complex queries can reason about it.
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  instrument: varchar("instrument", { length: 64 }), // decree_law | cabinet_decision | ministerial_decision | fta_guide | public_clarification
  jurisdiction: varchar("jurisdiction", { length: 16 }).notNull().default("UAE"),
  taxType: varchar("tax_type", { length: 16 }).notNull(), // CT | VAT
  sourceUrl: text("source_url"),
  effectiveDate: timestamp("effective_date"),
  version: varchar("version", { length: 64 }),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

// The searchable corpus. Each chunk maps to a real legal unit (article_ref)
// and carries the metadata a citation needs.
export const lawChunks = pgTable(
  "law_chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .references(() => documents.id)
      .notNull(),
    articleRef: text("article_ref"), // e.g. "Article 18(2)"
    content: text("content").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    jurisdiction: varchar("jurisdiction", { length: 16 })
      .notNull()
      .default("UAE"),
    taxType: varchar("tax_type", { length: 16 }).notNull(),
    effectiveDate: timestamp("effective_date"),
  },
  (t) => [
    index("law_chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// Every Q&A logged — for audit, eval scoring, and measuring F&A time saved.
export const queryLog = pgTable("query_log", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer"),
  status: varchar("status", { length: 16 }), // answered | escalate
  confidence: varchar("confidence", { length: 8 }), // high | medium | low
  retrievedChunkIds: jsonb("retrieved_chunk_ids"),
  citations: jsonb("citations"),
  createdAt: timestamp("created_at").defaultNow(),
});

// The trust backbone — who did/saw/approved what.
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actor: text("actor"),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").defaultNow(),
});
