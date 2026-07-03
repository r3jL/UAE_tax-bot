import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { usernameFrom } from "@/lib/auth/user";

export const runtime = "nodejs";

// Unread notifications for the current user (answers sent back from review).
export async function GET(req: NextRequest) {
  const username = usernameFrom(req);
  if (!username || !process.env.DATABASE_URL) {
    return NextResponse.json({ items: [] });
  }
  try {
    const items = await db
      .select({
        id: notifications.id,
        sessionId: notifications.sessionId,
        messageId: notifications.messageId,
        title: notifications.title,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.username, username), eq(notifications.read, "no")))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load notifications.";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}

// Mark one (or all) of the user's notifications read.
//   POST { id: number }  |  POST { all: true }
export async function POST(req: NextRequest) {
  const username = usernameFrom(req);
  if (!username || !process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.all === true) {
      await db
        .update(notifications)
        .set({ read: "yes" })
        .where(and(eq(notifications.username, username), eq(notifications.read, "no")));
      return NextResponse.json({ ok: true });
    }
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Missing notification id." }, { status: 400 });
    }
    await db
      .update(notifications)
      .set({ read: "yes" })
      .where(and(eq(notifications.id, id), eq(notifications.username, username)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
