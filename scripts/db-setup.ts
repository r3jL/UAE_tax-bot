import { config } from "dotenv";
// Load .env.local first (Next.js convention + what the README/.env.example use),
// then .env as a fallback. dotenv won't override vars already set.
config({ path: ".env.local" });
config();
import { neon } from "@neondatabase/serverless";

// Enables pgvector. Run once before the first migration: `npm run db:setup`.
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("pgvector extension ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
