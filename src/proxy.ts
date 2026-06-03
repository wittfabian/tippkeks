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
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/imprint",
  "/info",
  // Shared invite links must greet logged-out friends (they register from here).
  "/join",
  // The generated link-preview image: extensionless, so the matcher catches it;
  // crawlers fetch it logged-out, so a redirect to /login would yield no preview.
  "/opengraph-image",
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
    // The PWA files (manifest, service worker, offline page) must stay public —
    // they're fetched logged-out, so a redirect to /login would break installs.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
