import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
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

// Delete escalations from the queue. Any signed-in user may do this — the whole
// app sits behind the passcode gate (proxy.ts). Scoped to status = 'escalate'
// so it can ONLY remove queue items, never answered Q&A history.
//   DELETE /api/review-queue?id=123  → remove one escalation
//   DELETE /api/review-queue?all=1   → clear the entire queue
export async function DELETE(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "No database configured." }, { status: 503 });
  }
  const params = new URL(req.url).searchParams;
  const all = params.get("all");

  try {
    if (all === "1" || all === "true") {
      const deleted = await db
        .delete(queryLog)
        .where(eq(queryLog.status, "escalate"))
        .returning({ id: queryLog.id });
      return NextResponse.json({ ok: true, deleted: deleted.length });
    }

    const id = Number(params.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Pass ?id=<n> to delete one escalation, or ?all=1 to clear the queue." },
        { status: 400 },
      );
    }
    const deleted = await db
      .delete(queryLog)
      .where(and(eq(queryLog.id, id), eq(queryLog.status, "escalate")))
      .returning({ id: queryLog.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found (already removed?)." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
