// Side-effect module: load environment variables BEFORE anything that reads
// them. lib/ai/models.ts resolves the active provider/model at module-eval
// time, and ESM hoists `import` statements above inline code — so a plain
// `config()` call inside a script runs too late. Importing this module on the
// FIRST line guarantees dotenv runs before sibling imports are evaluated.
import { config } from "dotenv";

// .env.local first (Next.js convention + where `vercel env pull` writes), then
// .env as a fallback. dotenv never overrides already-set vars.
config({ path: ".env.local" });
config();
