import { config } from "dotenv";
// Load .env.local first (Next.js convention), then .env as a fallback.
config({ path: ".env.local" });
config();
import { neon } from "@neondatabase/serverless";

// Drops the corpus tables so `npm run db:push` recreates them fresh from the
// schema. Use this when the embedding dimension changes (the pgvector column
// size is fixed at create time) or to clear duplicate/partial rows from an
// earlier ingest. Leaves query_log (audit log) untouched.
//
// Full re-index sequence:
//   npm run db:reset
//   npm run db:push -- --force
//   npm run ingest
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  // law_chunks references documents, so drop it first (CASCADE is belt-and-braces).
  await sql`DROP TABLE IF EXISTS law_chunks CASCADE`;
  await sql`DROP TABLE IF EXISTS documents CASCADE`;
  console.log(
    "Dropped law_chunks + documents.\nNext: `npm run db:push -- --force` then `npm run ingest`.",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
