import { config } from "dotenv";
// Match the runtime + scripts: load .env.local first (where Next.js and
// `vercel env pull` put vars), then .env as a fallback. Without this,
// drizzle-kit only sees .env and misses DATABASE_URL from .env.local.
config({ path: ".env.local" });
config();
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
