import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { queryLog } from "@/lib/db/schema";

export const runtime = "nodejs";

// The Review Queue: every escalated Q&A, persisted in the shared cloud DB
// (query_log) and visible to ALL users — not per-session. Returned newest-first.
// Read-only for now; reviewer sign-off (approve/edit/send-back) is a later phase.
// Degrades to an empty list when no DB is provisioned, so the UI shows an empty
// state instead of erroring.
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ items: [], dbReady: false });
  }
  try {
    const items = await db
      .select({
        id: queryLog.id,
        question: queryLog.question,
        escalationReason: queryLog.escalationReason,
        confidence: queryLog.confidence,
        taxType: queryLog.taxType,
        createdAt: queryLog.createdAt,
      })
      .from(queryLog)
      .where(eq(queryLog.status, "escalate"))
      .orderBy(desc(queryLog.createdAt))
      .limit(200);
    return NextResponse.json({ items, dbReady: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load the review queue.";
    return NextResponse.json({ error: message, items: [], dbReady: true }, { status: 500 });
  }
}
