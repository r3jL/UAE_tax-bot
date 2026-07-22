import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  vector,
  jsonb,
  varchar,
  numeric,
  index,
  uniqueIndex,
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
  // Lifecycle + incremental-ingest identity.
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | superseded
  contentHash: varchar("content_hash", { length: 64 }), // hash of full doc text → doc-level fast-skip on re-ingest
  sourcePath: text("source_path"), // corpus-relative path; the stable identity across re-ingests
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
    // Supersession lifecycle. status='active' is the ONLY retrievable set;
    // 'superseded'/'repealed' rows stay for audit + as-of-date history queries.
    status: varchar("status", { length: 16 }).notNull().default("active"), // active | superseded | repealed
    supersededAt: timestamp("superseded_at"),
    supersededByChunkId: integer("superseded_by_chunk_id"), // plain int self-ref; FK enforced in ingest code
    version: varchar("version", { length: 64 }), // mirrors documents.version at ingest time
  },
  (t) => [
    index("law_chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    // Hot retrieval path now filters on status + effectiveDate.
    index("law_chunks_active_idx").on(t.status, t.effectiveDate),
    // Incremental-ingest diff lookups by document + content hash.
    index("law_chunks_doc_hash_idx").on(t.documentId, t.contentHash),
  ],
);

// Every Q&A logged — for audit, eval scoring, and measuring F&A time saved.
// Also the cloud store behind the Review Queue: escalated rows (status =
// 'escalate') are read back, newest-first, and shown to every user.
export const queryLog = pgTable(
  "query_log",
  {
    id: serial("id").primaryKey(),
    question: text("question").notNull(),
    answer: text("answer"),
    status: varchar("status", { length: 16 }), // answered | escalate | resolved
    confidence: varchar("confidence", { length: 8 }), // high | medium | low
    // CT | VAT | null — lets the Review Queue label/filter escalations by tax.
    taxType: varchar("tax_type", { length: 16 }),
    // Why an escalated Q&A needs a human — surfaced in the Review Queue.
    escalationReason: text("escalation_reason"),
    retrievedChunkIds: jsonb("retrieved_chunk_ids"),
    citations: jsonb("citations"),
    // Deterministic calculator output (tool name, classified input, schedule)
    // when the answer used one — the auditable ledger behind the numbers.
    computation: jsonb("computation"),
    // Who asked + where. username/sessionId are set only for signed-in
    // (non-guest) users; an escalation is answerable in the Review Queue ONLY
    // when it carries a username to route the answer back to.
    username: varchar("username", { length: 64 }),
    sessionId: integer("session_id"),
    // A reviewer's human answer sent back from the Review Queue, and who/when.
    // Setting these flips status → 'resolved' and drops the row out of the queue.
    reviewerAnswer: text("reviewer_answer"),
    reviewedBy: varchar("reviewed_by", { length: 64 }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    // The Review Queue filters by status and sorts newest-first.
    index("query_log_status_idx").on(t.status, t.createdAt),
  ],
);

// A saved chat thread, owned by a username. Guests don't get sessions.
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("chat_sessions_user_idx").on(t.username, t.updatedAt)],
);

// One message in a session. role='reviewer' is a human answer sent back from
// the Review Queue. `data` carries the rich payload (AnswerResult for assistant
// turns, file names for user turns, reviewer name for reviewer turns).
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .references(() => chatSessions.id)
      .notNull(),
    role: varchar("role", { length: 16 }).notNull(), // user | assistant | reviewer
    content: text("content").notNull().default(""),
    data: jsonb("data"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("chat_messages_session_idx").on(t.sessionId, t.createdAt)],
);

// A "your question was answered" ping for the asker, created when a reviewer
// sends an answer back. Clicking it opens the session at the reviewer's reply.
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 64 }).notNull(), // recipient
    sessionId: integer("session_id")
      .references(() => chatSessions.id)
      .notNull(),
    messageId: integer("message_id"), // the reviewer message to scroll to
    queryLogId: integer("query_log_id"),
    title: text("title").notNull(),
    read: varchar("read", { length: 4 }).notNull().default("no"), // no | yes
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.username, t.read, t.createdAt)],
);

// The trust backbone — who did/saw/approved what.
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actor: text("actor"),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit record of WHAT changed when the corpus is re-ingested or a watched
// source is detected as changed. We don't act on impact yet (no past-answer
// re-review workflow this phase) — this is the durable trail of every diff.
export const lawChanges = pgTable("law_changes", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id),
  chunkId: integer("chunk_id"), // the new chunk (added/modified); null for removed
  previousChunkId: integer("previous_chunk_id"), // superseded predecessor; null for added
  changeType: varchar("change_type", { length: 16 }).notNull(), // added | modified | removed
  oldContentHash: varchar("old_content_hash", { length: 64 }),
  newContentHash: varchar("new_content_hash", { length: 64 }),
  articleRef: text("article_ref"),
  source: varchar("source", { length: 16 }).notNull().default("ingest"), // ingest | cron
  detectedAt: timestamp("detected_at").defaultNow(),
  detail: jsonb("detail"), // { sourcePath, sourceUrl, ... }
});

// Versioned, effective-dated tax parameters (rates, thresholds, dates). A
// "value change" is a DATA edit: insert a new row with a later effectiveDate
// and close the prior row (set supersededAt) — no redeploy. The current value
// for a key = the row with the latest effectiveDate <= asOf and supersededAt
// null/after. History is never deleted, so as-of-date queries stay correct.
export const taxParameters = pgTable(
  "tax_parameters",
  {
    id: serial("id").primaryKey(),
    // Stable dotted key, e.g. 'vat.standard_rate', 'ct.threshold.0pct'.
    paramKey: varchar("param_key", { length: 64 }).notNull(),
    jurisdiction: varchar("jurisdiction", { length: 16 })
      .notNull()
      .default("UAE"),
    taxType: varchar("tax_type", { length: 16 }).notNull(), // VAT | CT | EXCISE | GEN
    kind: varchar("kind", { length: 8 }).notNull(), // rate | amount | date | text
    valueNumeric: numeric("value_numeric"), // rate (0.05) or amount (375000) — Drizzle returns a STRING; parse once
    valueText: text("value_text"),
    valueDate: timestamp("value_date"),
    unit: varchar("unit", { length: 16 }), // ratio | AED | EUR | years | days | months | date | null
    effectiveDate: timestamp("effective_date").notNull(),
    supersededAt: timestamp("superseded_at"), // null = current
    sourceUrl: text("source_url"),
    articleRef: text("article_ref"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("tax_parameters_lookup_idx").on(
      t.paramKey,
      t.jurisdiction,
      t.effectiveDate,
    ),
    // At most one row per (key, jurisdiction, effectiveDate) version.
    uniqueIndex("tax_parameters_version_uq").on(
      t.paramKey,
      t.jurisdiction,
      t.effectiveDate,
    ),
  ],
);
