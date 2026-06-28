import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Passcode gate. Everything is protected except the login page, the auth
// endpoint, and the cron endpoints (which authenticate themselves with a Bearer
// CRON_SECRET — Vercel Cron never carries the lex_auth cookie). The cookie holds
// AUTH_TOKEN (a server secret), set only after the passcode is verified
// server-side — so it can't be forged.
const PUBLIC = ["/login", "/api/auth", "/api/cron"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = process.env.AUTH_TOKEN;
  const authed = !!token && request.cookies.get("lex_auth")?.value === token;
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized — sign in first." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except static assets (so CSS/JS/images still load).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
