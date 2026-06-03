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
 * Reduce the `next` redirect target to a safe same-origin path. Accepts a relative
 * path (`/foo`) directly, and an absolute URL only when its origin matches ours —
 * collapsed to pathname+search. The signup confirmation template now carries the
 * GoTrue redirect (`{{ .RedirectTo }}`, an absolute URL) here, so we must handle
 * both forms. Anything else (cross-origin, protocol-relative `//evil.com`) is an
 * open-redirect attempt and falls to "/".
 */
function safeNext(next: string | null, origin: string): string {
  if (!next) return "/";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  try {
    const url = new URL(next);
    if (url.origin === new URL(origin).origin) return `${url.pathname}${url.search}`;
  } catch {
    // Not a parseable absolute URL — fall through to the safe default.
  }
  return "/";
}

/**
 * Extract the invite code from a `/join/<code>` redirect path, if present. A signup
 * that began from a shared invite link routes its confirmation here with this path
 * as `next`; redeeming the code after verifyOtp lands the user straight in the group.
 */
function inviteCodeFromPath(path: string): string | null {
  const match = /^\/join\/([^/?#]+)/.exec(path);
  return match?.[1] ? decodeURIComponent(match[1]).trim().toUpperCase() : null;
}

/**
 * Public origin to build the post-verification redirect against. `request.url`
 * behind the reverse proxy carries the internal bind address (0.0.0.0:3000), so
 * prefer the configured SITE_URL, then the proxy's forwarded host/proto, and only
 * fall back to the request URL (correct in local dev without a proxy).
 */
function resolveOrigin(request: NextRequest): string {
  if (serverEnv.SITE_URL) return serverEnv.SITE_URL;
  // In production SITE_URL is mandatory: never derive the redirect origin from the
  // attacker-controllable Host / X-Forwarded-Host header (host-header injection).
  if (process.env.NODE_ENV === "production") {
    throw new Error("SITE_URL must be set in production to resolve the redirect origin");
  }
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto && host) return `${proto}://${host}`;
  return request.url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const origin = resolveOrigin(request);
  const next = safeNext(searchParams.get("next"), origin);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // verifyOtp has set the session cookies, so this cookie-aware client is now
      // authenticated. If the confirmation originated from an invite link, redeem
      // the code and land the user directly in the group. Redemption failure is
      // non-fatal — fall back to the /join page, which shows the invalid/expired
      // state and a manual accept button.
      const code = inviteCodeFromPath(next);
      if (code) {
        const { data } = await supabase.rpc("redeem_invite", { p_code: code });
        if (data?.id) return NextResponse.redirect(new URL(`/${data.id}`, origin));
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login", origin));
}
