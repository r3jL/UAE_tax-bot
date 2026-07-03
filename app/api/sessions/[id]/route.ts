import { NextRequest, NextResponse } from "next/server";
import { usernameFrom } from "@/lib/auth/user";
import { deleteSession, getSessionMessages } from "@/lib/db/sessions";

export const runtime = "nodejs";

// Load one session's messages (ownership-checked) so the client can rehydrate
// the thread — including any reviewer answer sent back into it.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const username = usernameFrom(req);
  if (!username) return NextResponse.json({ error: "Sign in with a username." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Bad session id." }, { status: 400 });
  }
  try {
    const data = await getSessionMessages(username, id);
    if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const username = usernameFrom(req);
  if (!username) return NextResponse.json({ error: "Sign in with a username." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Bad session id." }, { status: 400 });
  }
  try {
    const ok = await deleteSession(username, id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
