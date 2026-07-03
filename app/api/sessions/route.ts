import { NextRequest, NextResponse } from "next/server";
import { usernameFrom } from "@/lib/auth/user";
import { listSessions } from "@/lib/db/sessions";

export const runtime = "nodejs";

// List the current user's saved chat sessions, newest-first. Guests (no
// username) have no history, so this returns an empty list for them.
export async function GET(req: NextRequest) {
  const username = usernameFrom(req);
  if (!username || !process.env.DATABASE_URL) {
    return NextResponse.json({ sessions: [] });
  }
  try {
    const sessions = await listSessions(username);
    return NextResponse.json({ sessions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load sessions.";
    return NextResponse.json({ error: message, sessions: [] }, { status: 500 });
  }
}
