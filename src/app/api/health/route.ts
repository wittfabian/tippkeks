import { NextResponse } from "next/server";

// Always run on request; never cached.
export const dynamic = "force-dynamic";

/**
 * Liveness probe for the container HEALTHCHECK / reverse proxy. Deliberately a
 * pure process-up check: no auth, no DB, no Redis — so a transient Supabase or
 * Valkey blip does not flap the app container into a restart loop. It sits
 * outside the proxy auth matcher (which excludes /api), so it answers without a
 * session. Returns 200 as long as the Node server can serve a request.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
