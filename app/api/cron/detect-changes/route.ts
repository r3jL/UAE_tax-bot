import { NextRequest, NextResponse } from "next/server";
import { extname } from "path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, lawChanges, auditLog } from "@/lib/db/schema";
import { hashContent } from "@/lib/rag/chunk";
import { bytesToText } from "@/lib/rag/extract";
import manifestJson from "@/corpus/manifest.json";

export const runtime = "nodejs";
// Conservative ceiling (matches the chat route's known-good config). Watching
// many large PDFs may need this raised — only possible on plans that allow it.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Scheduled change detector. Re-fetches the curated set of "watch" sources in
// corpus/manifest.json and diffs each against the stored documents.contentHash
// by hashing the EXTRACTED TEXT (same extraction path as ingest, so a re-exported
// but identical PDF doesn't cry wolf). It is FLAG-ONLY: a detected change is
// recorded in law_changes (source='cron') + audit_log; it does NOT mutate the
// corpus. A human reviews, drops the updated official file into corpus/, and
// runs `npm run ingest` — keeping a person in the loop for legal correctness.
//
// Bundled at build time via the JSON import, so the manifest is always available
// in the serverless function (no runtime fs dependency on corpus/).

type ManifestEntry = {
  sourceUrl?: string;
  watch?: boolean;
  title?: string;
};

// Cast through unknown: the JSON carries a "//" comment string alongside the
// object entries, so the inferred type doesn't cleanly match the record shape.
const manifest = manifestJson as unknown as Record<string, ManifestEntry>;

export async function GET(req: NextRequest) {
  // Vercel Cron authenticates with Authorization: Bearer <CRON_SECRET>.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watched = Object.entries(manifest).filter(
    ([, m]) => m && m.watch && m.sourceUrl,
  );

  const results: { sourcePath: string; status: string }[] = [];
  let changed = 0;

  for (const [sourcePath, m] of watched) {
    try {
      const res = await fetch(m.sourceUrl!, { redirect: "follow" });
      if (!res.ok) {
        results.push({ sourcePath, status: `fetch_${res.status}` });
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const isPdf =
        extname(sourcePath).toLowerCase() === ".pdf" ||
        (res.headers.get("content-type") ?? "").includes("pdf");
      const fetchedHash = hashContent(await bytesToText(bytes, isPdf));

      const doc = (
        await db
          .select({ id: documents.id, contentHash: documents.contentHash })
          .from(documents)
          .where(eq(documents.sourcePath, sourcePath))
          .limit(1)
      )[0];

      if (!doc) {
        results.push({ sourcePath, status: "not_ingested" });
        continue;
      }
      if (doc.contentHash && doc.contentHash !== fetchedHash) {
        changed++;
        await db.insert(lawChanges).values({
          documentId: doc.id,
          changeType: "modified",
          oldContentHash: doc.contentHash,
          newContentHash: fetchedHash,
          source: "cron",
          detail: { sourcePath, sourceUrl: m.sourceUrl },
        });
        await db.insert(auditLog).values({
          action: "cron_change_detected",
          detail: { sourcePath, sourceUrl: m.sourceUrl },
        });
        results.push({ sourcePath, status: "changed" });
      } else {
        results.push({ sourcePath, status: "unchanged" });
      }
    } catch (e) {
      results.push({ sourcePath, status: `error:${(e as Error).message}` });
    }
  }

  return NextResponse.json({ checked: watched.length, changed, mode: "flag-only", results });
}
