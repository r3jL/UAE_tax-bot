import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Verify the passcode (server-side, against APP_PASSCODE) and, on success, set
// the httpOnly auth cookie. The passcode never reaches the client bundle.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const passcode = typeof body?.passcode === "string" ? body.passcode.trim() : "";

  if (passcode && passcode === process.env.APP_PASSCODE) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("lex_auth", process.env.AUTH_TOKEN ?? "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }
  return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
}

// Sign out.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("lex_auth", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
