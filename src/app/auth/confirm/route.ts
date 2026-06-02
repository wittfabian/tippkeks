import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the email-confirmation / recovery link Supabase sends when email
 * confirmation is enabled (production). Verifies the OTP, which sets the session
 * cookies, then redirects. No-op for local dev where confirmation is disabled.
 */
/**
 * Only same-origin, non-protocol-relative paths are accepted as a redirect
 * target. `new URL(next, base)` would otherwise honour an absolute
 * (`https://evil.com`) or protocol-relative (`//evil.com`) value and bounce the
 * just-authenticated user off-site — an open redirect. Anything else falls to "/".
 */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

/**
 * Public origin to build the post-verification redirect against. `request.url`
 * behind the reverse proxy carries the internal bind address (0.0.0.0:3000), so
 * prefer the configured SITE_URL, then the proxy's forwarded host/proto, and only
 * fall back to the request URL (correct in local dev without a proxy).
 */
function resolveOrigin(request: NextRequest): string {
  if (serverEnv.SITE_URL) return serverEnv.SITE_URL;
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto && host) return `${proto}://${host}`;
  return request.url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  const origin = resolveOrigin(request);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login", origin));
}
