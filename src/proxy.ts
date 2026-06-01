import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

// Next 16 renamed Middleware to Proxy. This refreshes the auth session and
// redirects unauthenticated users away from protected pages. It is NOT the only
// guard — every protected layout/page and Server Action re-checks auth, and
// Postgres RLS is the final gate (Server Actions are POSTs that the matcher
// could otherwise skip).
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/auth",
  "/passwort-vergessen",
  "/passwort-neu",
  "/datenschutz",
  "/impressum",
  "/info",
  // Shared invite links must greet logged-out friends (they register from here).
  "/beitreten",
];

function isPublic(pathname: string): boolean {
  // The marketing landing page lives at the root and must be reachable signed-out.
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!claims && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except API routes, Next internals and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
