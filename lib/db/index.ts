import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  // Not throwing at import time so the app can boot before provisioning;
  // queries will fail with a clear message until DATABASE_URL is set.
  console.warn("[db] DATABASE_URL is not set — database queries will fail.");
}

// Format-valid placeholder so the module imports cleanly before provisioning
// (e.g. during `next build` page-data collection). It never connects until a
// real query runs — which will fail loudly if DATABASE_URL is still unset.
const sql = neon(
  process.env.DATABASE_URL ?? "postgresql://user:password@localhost:5432/db",
);
export const db = drizzle(sql, { schema });
