import "server-only";

import webpush from "web-push";

import type { ScoreCategory } from "@/lib/scoring/engine";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";
import { de } from "@/messages/de";

type ServiceClient = ReturnType<typeof createServiceClient>;

/** How long before kickoff the "you haven't tipped" reminder fires. */
const REMINDER_LEAD_MS = 60 * 60 * 1000;

export interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Outcome of a single send: "gone" means the subscription is dead (prune it). */
export type PushSender = (target: PushTarget, payload: NotificationPayload) => Promise<SendResult>;
export type SendResult = "ok" | "gone" | "error";

export interface DispatchReport {
  reminders: number;
  results: number;
}

/**
 * Build the real web-push sender, or null when VAPID is not configured (the
 * dispatcher then no-ops, like the cache without REDIS_URL). A 404/410 from the
 * push service means the subscription expired → caller prunes it.
 */
function realSender(): PushSender | null {
  const publicKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = serverEnv.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;

  webpush.setVapidDetails(serverEnv.VAPID_SUBJECT, publicKey, privateKey);

  return async (target, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
      );
      return "ok";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      return status === 404 || status === 410 ? "gone" : "error";
    }
  };
}

/**
 * Send any due push notifications: a tip reminder ~1h before kickoff for members
 * who have not tipped, and a result push (with the member's own points) once a
 * fixture is finished. Idempotent across the 120s cron cadence via the
 * notification_delivery ledger. Runs with the service role.
 *
 * `sender` is injectable so tests can assert recipient selection + dedup without
 * a real push endpoint. Default is the VAPID-backed web-push sender (null when
 * push is not configured, which makes the whole call a no-op).
 */
export async function dispatchNotifications(
  sender: PushSender | null = realSender(),
): Promise<DispatchReport> {
  if (!sender) return { reminders: 0, results: 0 };
  const supabase = createServiceClient();
  const reminders = await dispatchReminders(supabase, sender);
  const results = await dispatchResults(supabase, sender);
  return { reminders, results };
}

/** Subscriptions for a set of users, grouped by user. */
async function subscriptionsByUser(
  supabase: ServiceClient,
  userIds: string[],
): Promise<Map<string, PushTarget[]>> {
  const byUser = new Map<string, PushTarget[]>();
  if (userIds.length === 0) return byUser;
  const { data } = await supabase
    .from("push_subscription")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    byUser.set(row.user_id, list);
  }
  return byUser;
}

/**
 * Deliver one notification to every device of a recipient, then record it in the
 * ledger (so later ticks skip it) and prune any dead subscriptions. Returns 1 if
 * at least one device accepted it, else 0.
 */
async function deliver(
  supabase: ServiceClient,
  sender: PushSender,
  ledger: { tenantId: string; userId: string; fixtureId: string; kind: "tip_reminder" | "result" },
  targets: PushTarget[],
  payload: NotificationPayload,
): Promise<number> {
  let delivered = false;
  for (const target of targets) {
    const result = await sender(target, payload);
    if (result === "ok") delivered = true;
    else if (result === "gone") {
      await supabase.from("push_subscription").delete().eq("endpoint", target.endpoint);
    }
  }
  // Record regardless of per-device outcome: a recipient with no live device
  // still should not be retried forever. (No live device → nothing was shown.)
  await supabase.from("notification_delivery").insert({
    tenant_id: ledger.tenantId,
    user_id: ledger.userId,
    fixture_id: ledger.fixtureId,
    kind: ledger.kind,
  });
  return delivered ? 1 : 0;
}

/** Team id → display name (short name preferred) for a set of fixtures. */
async function teamNames(supabase: ServiceClient, teamIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (teamIds.length === 0) return names;
  const { data } = await supabase.from("team").select("id, name, short_name").in("id", teamIds);
  for (const t of data ?? []) names.set(t.id, t.short_name ?? t.name);
  return names;
}

/** Tip reminders for fixtures kicking off within the next hour. */
async function dispatchReminders(supabase: ServiceClient, sender: PushSender): Promise<number> {
  const nowIso = new Date().toISOString();
  const horizonIso = new Date(Date.now() + REMINDER_LEAD_MS).toISOString();

  const { data: fixtures } = await supabase
    .from("fixture")
    .select("id, season_id, home_team_id, away_team_id")
    .eq("status", "scheduled")
    .gt("kickoff_at", nowIso)
    .lte("kickoff_at", horizonIso);
  if (!fixtures || fixtures.length === 0) return 0;

  const fixtureIds = fixtures.map((f) => f.id);
  const seasonIds = [...new Set(fixtures.map((f) => f.season_id))];

  // Tenants that subscribe to these seasons AND let members tip themselves.
  const { data: tenantSeasons } = await supabase
    .from("tenant_season")
    .select("tenant_id, season_id")
    .in("season_id", seasonIds);
  const tenantIds = [...new Set((tenantSeasons ?? []).map((t) => t.tenant_id))];
  if (tenantIds.length === 0) return 0;

  const { data: tippingTenants } = await supabase
    .from("tenant")
    .select("id")
    .in("id", tenantIds)
    .eq("member_tipping_enabled", true);
  const tippingTenantIds = new Set((tippingTenants ?? []).map((t) => t.id));
  const tenantsForSeason = new Map<string, string[]>();
  for (const ts of tenantSeasons ?? []) {
    if (!tippingTenantIds.has(ts.tenant_id)) continue;
    const list = tenantsForSeason.get(ts.season_id) ?? [];
    list.push(ts.tenant_id);
    tenantsForSeason.set(ts.season_id, list);
  }

  const activeTenantIds = [...tippingTenantIds];
  if (activeTenantIds.length === 0) return 0;

  // Members per tenant, who already tipped, who already got reminded, names, subs.
  const [{ data: members }, { data: predictions }, { data: delivered }] = await Promise.all([
    supabase.from("tenant_member").select("tenant_id, user_id").in("tenant_id", activeTenantIds),
    supabase
      .from("prediction")
      .select("tenant_id, user_id, fixture_id")
      .in("tenant_id", activeTenantIds)
      .in("fixture_id", fixtureIds),
    supabase
      .from("notification_delivery")
      .select("tenant_id, user_id, fixture_id")
      .eq("kind", "tip_reminder")
      .in("fixture_id", fixtureIds),
  ]);

  const tipped = new Set((predictions ?? []).map((p) => key(p.tenant_id, p.user_id, p.fixture_id)));
  const reminded = new Set((delivered ?? []).map((d) => key(d.tenant_id, d.user_id, d.fixture_id)));
  const membersByTenant = new Map<string, string[]>();
  for (const m of members ?? []) {
    const list = membersByTenant.get(m.tenant_id) ?? [];
    list.push(m.user_id);
    membersByTenant.set(m.tenant_id, list);
  }

  const names = await teamNames(supabase, [
    ...new Set(fixtures.flatMap((f) => [f.home_team_id, f.away_team_id].filter(isString))),
  ]);
  const allMemberIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const subs = await subscriptionsByUser(supabase, allMemberIds);

  let sent = 0;
  for (const fixture of fixtures) {
    const home = nameOf(names, fixture.home_team_id);
    const away = nameOf(names, fixture.away_team_id);
    const payloadBase = {
      title: de.notifications.reminderTitle,
      body: de.notifications.reminderBody(home, away),
    };
    for (const tenantId of tenantsForSeason.get(fixture.season_id) ?? []) {
      for (const userId of membersByTenant.get(tenantId) ?? []) {
        const k = key(tenantId, userId, fixture.id);
        if (tipped.has(k) || reminded.has(k)) continue;
        const targets = subs.get(userId);
        if (!targets || targets.length === 0) continue;
        sent += await deliver(
          supabase,
          sender,
          { tenantId, userId, fixtureId: fixture.id, kind: "tip_reminder" },
          targets,
          {
            ...payloadBase,
            url: `/${tenantId}/match/${fixture.id}`,
            tag: `reminder-${fixture.id}`,
          },
        );
      }
    }
  }
  return sent;
}

/** Result pushes (incl. own points) for finished fixtures not yet notified. */
async function dispatchResults(supabase: ServiceClient, sender: PushSender): Promise<number> {
  const { data: fixtures } = await supabase
    .from("fixture")
    .select("id, home_team_id, away_team_id, regular_home, regular_away")
    .eq("status", "finished")
    .not("regular_home", "is", null)
    .not("regular_away", "is", null);
  if (!fixtures || fixtures.length === 0) return 0;

  const fixtureIds = fixtures.map((f) => f.id);
  const [{ data: scores }, { data: delivered }] = await Promise.all([
    supabase
      .from("prediction_score")
      .select("tenant_id, user_id, fixture_id, points, category")
      .in("fixture_id", fixtureIds),
    supabase
      .from("notification_delivery")
      .select("tenant_id, user_id, fixture_id")
      .eq("kind", "result")
      .in("fixture_id", fixtureIds),
  ]);
  if (!scores || scores.length === 0) return 0;

  const notified = new Set((delivered ?? []).map((d) => key(d.tenant_id, d.user_id, d.fixture_id)));
  const pending = scores.filter((s) => !notified.has(key(s.tenant_id, s.user_id, s.fixture_id)));
  if (pending.length === 0) return 0;

  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const names = await teamNames(supabase, [
    ...new Set(fixtures.flatMap((f) => [f.home_team_id, f.away_team_id].filter(isString))),
  ]);
  const subs = await subscriptionsByUser(supabase, [...new Set(pending.map((s) => s.user_id))]);

  let sent = 0;
  for (const score of pending) {
    const fixture = fixtureById.get(score.fixture_id);
    if (!fixture || fixture.regular_home === null || fixture.regular_away === null) continue;
    const targets = subs.get(score.user_id);
    if (!targets || targets.length === 0) {
      // Still record so we don't re-scan this forever for a subscription-less user.
      await supabase.from("notification_delivery").insert({
        tenant_id: score.tenant_id,
        user_id: score.user_id,
        fixture_id: score.fixture_id,
        kind: "result",
      });
      continue;
    }
    const home = nameOf(names, fixture.home_team_id);
    const away = nameOf(names, fixture.away_team_id);
    sent += await deliver(
      supabase,
      sender,
      {
        tenantId: score.tenant_id,
        userId: score.user_id,
        fixtureId: score.fixture_id,
        kind: "result",
      },
      targets,
      {
        title: de.notifications.resultTitle(home, away, fixture.regular_home, fixture.regular_away),
        body: de.notifications.resultBody(score.category as ScoreCategory, score.points),
        url: `/${score.tenant_id}/match/${score.fixture_id}`,
        tag: `result-${score.fixture_id}`,
      },
    );
  }
  return sent;
}

function key(tenantId: string, userId: string, fixtureId: string): string {
  return `${tenantId}:${userId}:${fixtureId}`;
}

function isString(value: string | null): value is string {
  return value !== null;
}

function nameOf(names: Map<string, string>, teamId: string | null): string {
  return (teamId !== null ? names.get(teamId) : undefined) ?? "?";
}
