import type { NextConfig } from "next";

// Supabase origin must be reachable for auth + data (REST + Realtime/WebSocket).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseOrigin = "";
try {
  supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
} catch {
  supabaseOrigin = "";
}
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

// Content-Security-Policy. 'unsafe-inline' for scripts/styles is the pragmatic
// choice for the Next App Router without per-request nonces (a future
// improvement via the proxy); all user content is rendered through React and
// escaped, so the stored/reflected-XSS surface is minimal. frame-ancestors and
// object-src lock out clickjacking and plugin embeds.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src ${["'self'", supabaseOrigin, supabaseWs].filter(Boolean).join(" ")}`,
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  // HSTS: ignored by browsers on http/localhost, enforced once served over TLS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone) for a minimal production
  // container image — see Dockerfile.
  output: "standalone",
  async headers() {
    // CSP is applied only in production: dev (Turbopack/React Refresh) needs
    // inline eval that a strict policy would block.
    const headers =
      process.env.NODE_ENV === "production"
        ? [...securityHeaders, { key: "Content-Security-Policy", value: csp }]
        : securityHeaders;
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
