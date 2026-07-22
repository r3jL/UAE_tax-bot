import { config } from "dotenv";
// Load .env.local first (Next.js convention), then .env as a fallback.
config({ path: ".env.local" });
config();
import { neon } from "@neondatabase/serverless";

// Additive, idempotent migration. Brings an existing database up to the
// versioning/supersession + tax_parameters schema WITHOUT dropping or rewriting
// any existing rows. Every statement is guarded with IF NOT EXISTS, so it is
// safe to run repeatedly.
//
// We use this instead of `drizzle-kit generate`/`push` because there is no
// existing drizzle migration history, and a fresh generate would try to emit
// CREATE TABLE for the already-live documents/law_chunks tables. Run with:
//   npm run db:migrate-additive
//
// This REPLACES the old destructive update playbook (db:reset → db:push
// --force → ingest). Keep db:reset only for the genuine embedding-dimension
// change it documents.
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  // --- documents: lifecycle + incremental-ingest identity ---
  await sql`
    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS content_hash varchar(64),
      ADD COLUMN IF NOT EXISTS source_path text
  `;

  // --- law_chunks: supersession lifecycle ---
  await sql`
    ALTER TABLE law_chunks
      ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS superseded_at timestamp,
      ADD COLUMN IF NOT EXISTS superseded_by_chunk_id integer,
      ADD COLUMN IF NOT EXISTS version varchar(64)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS law_chunks_active_idx
      ON law_chunks (status, effective_date)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS law_chunks_doc_hash_idx
      ON law_chunks (document_id, content_hash)
  `;

  // --- law_changes: audit trail of every diff ---
  await sql`
    CREATE TABLE IF NOT EXISTS law_changes (
      id serial PRIMARY KEY,
      document_id integer REFERENCES documents(id),
      chunk_id integer,
      previous_chunk_id integer,
      change_type varchar(16) NOT NULL,
      old_content_hash varchar(64),
      new_content_hash varchar(64),
      article_ref text,
      source varchar(16) NOT NULL DEFAULT 'ingest',
      detected_at timestamp DEFAULT now(),
      detail jsonb
    )
  `;

  // --- tax_parameters: versioned, effective-dated config ---
  await sql`
    CREATE TABLE IF NOT EXISTS tax_parameters (
      id serial PRIMARY KEY,
      param_key varchar(64) NOT NULL,
      jurisdiction varchar(16) NOT NULL DEFAULT 'UAE',
      tax_type varchar(16) NOT NULL,
      kind varchar(8) NOT NULL,
      value_numeric numeric,
      value_text text,
      value_date timestamp,
      unit varchar(16),
      effective_date timestamp NOT NULL,
      superseded_at timestamp,
      source_url text,
      article_ref text,
      note text,
      created_at timestamp DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS tax_parameters_lookup_idx
      ON tax_parameters (param_key, jurisdiction, effective_date)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS tax_parameters_version_uq
      ON tax_parameters (param_key, jurisdiction, effective_date)
  `;

  // --- query_log: Review Queue fields (escalation reason + tax type) ---
  // The Review Queue reads escalated Q&A from query_log. Create the table if a
  // DB predates `drizzle-kit push`, then add the new columns idempotently.
  await sql`
    CREATE TABLE IF NOT EXISTS query_log (
      id serial PRIMARY KEY,
      question text NOT NULL,
      answer text,
      status varchar(16),
      confidence varchar(8),
      retrieved_chunk_ids jsonb,
      citations jsonb,
      created_at timestamp DEFAULT now()
    )
  `;
  await sql`
    ALTER TABLE query_log
      ADD COLUMN IF NOT EXISTS tax_type varchar(16),
      ADD COLUMN IF NOT EXISTS escalation_reason text,
      ADD COLUMN IF NOT EXISTS computation jsonb
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS query_log_status_idx
      ON query_log (status, created_at)
  `;

  console.log(
    "Additive migration applied: lifecycle columns, law_changes, tax_parameters, query_log review-queue fields.",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
