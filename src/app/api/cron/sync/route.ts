import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env.server";
import { footballDataProvider } from "@/lib/providers/footballData";
import { runSync } from "@/lib/sync/run";

// Always run on request; never cached.
export const dynamic = "force-dynamic";

/**
 * Secret-protected sync trigger for the OS/container scheduler. Authenticated by
 * a Bearer token (CRON_SECRET), NOT a user session, so it sits outside the proxy
 * auth matcher (which excludes /api). Returns 404 when no secret is configured
 * so the endpoint is invisible until deliberately enabled.
 */
export async function POST(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authorized = request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runSync(footballDataProvider());
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    console.error("[cron/sync] failed:", error);
    return NextResponse.json({ ok: false, error: "Sync failed" }, { status: 500 });
  }
}
