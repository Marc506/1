import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Optimistic gate: no valid session cookie -> /login (pages) or 401 (API).
 * Pages and handlers still call requireOwnerId() before touching data.
 */
export async function proxy(request: NextRequest) {
  const ownerId = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
  if (ownerId) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except the login page, Next internals and static files.
    "/((?!login|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icons/|vendor/|robots\\.txt).*)",
  ],
};
