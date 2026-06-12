import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env.server";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { footballDataProvider } from "@/lib/providers/footballData";
import { runSync } from "@/lib/sync/run";

// Always run on request; never cached.
export const dynamic = "force-dynamic";

/** Constant-time string compare so the Bearer secret can't be timing-probed. */
function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

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

  const authorized = secretsMatch(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runSync(footballDataProvider());

    // Push reminders/results run on the same cadence. Isolated so a push failure
    // never fails the sync (its report is the authoritative success signal).
    let notifications: Awaited<ReturnType<typeof dispatchNotifications>> | null = null;
    try {
      notifications = await dispatchNotifications();
    } catch (error) {
      console.error("[cron/sync] notifications failed:", error);
    }

    return NextResponse.json({ ok: true, ...report, notifications });
  } catch (error) {
    console.error("[cron/sync] failed:", error);
    return NextResponse.json({ ok: false, error: "Sync failed" }, { status: 500 });
  }
}
