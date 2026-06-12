import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationPayload, PushSender, SendResult } from "@/lib/notifications/dispatch";
import { adminClient, createSignedInUser, deleteUserByEmail, hasSupabase } from "./helpers";

const suite = hasSupabase ? describe : describe.skip;

// Imported lazily in beforeAll (only when hasSupabase) so CI — which has no
// Supabase env — never loads the env-backed module chain: env.ts throws at import
// when NEXT_PUBLIC_* are unset. A skipped suite never runs beforeAll.
let dispatchNotifications: typeof import("@/lib/notifications/dispatch").dispatchNotifications;

const EMAILS = {
  a: "itest_notif_admin@example.com",
  b: "itest_notif_member@example.com",
};
const GROUP_NAME = "Notif Test";
const INVITE_CODE = "NOTIFCODE";
const PROVIDER = "itest-notif";

/** A fake sender that records every push and returns a configurable result. */
function recorder(result: SendResult = "ok") {
  const sent: { endpoint: string; payload: NotificationPayload }[] = [];
  const sender: PushSender = async (target, payload) => {
    sent.push({ endpoint: target.endpoint, payload });
    return result;
  };
  return { sent, sender };
}

suite("notification dispatch (integration)", () => {
  let admin: SupabaseClient;
  let cA: SupabaseClient;
  let cB: SupabaseClient;
  let uidA: string;
  let uidB: string;
  let tenantId: string;
  let seasonId: string;
  let teamHome: string;
  let teamAway: string;

  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

  /** Insert a scheduled fixture in the WC season; returns its id. */
  async function scheduledFixture(extId: string, kickoff: string): Promise<string> {
    const { data, error } = await admin
      .from("fixture")
      .insert({
        season_id: seasonId,
        home_team_id: teamHome,
        away_team_id: teamAway,
        status: "scheduled",
        provider: PROVIDER,
        external_id: extId,
        kickoff_at: kickoff,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  async function cleanup() {
    await admin.from("tenant").delete().eq("name", GROUP_NAME);
    await admin.from("fixture").delete().eq("provider", PROVIDER);
    await Promise.all([deleteUserByEmail(EMAILS.a), deleteUserByEmail(EMAILS.b)]);
  }

  beforeAll(async () => {
    ({ dispatchNotifications } = await import("@/lib/notifications/dispatch"));
    admin = adminClient();
    await cleanup();

    await admin
      .from("app_setting")
      .update({ value: { enabled: true } })
      .eq("key", "group_creation_enabled");

    ({ client: cA, userId: uidA } = await createSignedInUser(EMAILS.a, "password123"));
    ({ client: cB, userId: uidB } = await createSignedInUser(EMAILS.b, "password123"));

    const { data: tenant, error } = await cA.rpc("create_group", { p_name: GROUP_NAME });
    if (error) throw error;
    tenantId = tenant.id;

    await cA
      .from("tenant_invite")
      .insert({ tenant_id: tenantId, code: INVITE_CODE, role: "member" });
    const { error: joinError } = await cB.rpc("redeem_invite", { p_code: INVITE_CODE });
    if (joinError) throw joinError;

    const { data: season } = await admin
      .from("season")
      .select("id")
      .eq("provider", "openfootball")
      .eq("external_id", "wc-2026")
      .single();
    seasonId = season!.id;
    const { data: teams } = await admin
      .from("team")
      .select("id")
      .eq("provider", "openfootball")
      .limit(2);
    [teamHome, teamAway] = (teams ?? []).map((t) => t.id);

    // Both members own a push subscription.
    await admin.from("push_subscription").insert([
      { user_id: uidA, endpoint: "https://push.example/A", p256dh: "pa", auth: "aa" },
      { user_id: uidB, endpoint: "https://push.example/B", p256dh: "pb", auth: "ab" },
    ]);
  }, 30_000);

  afterAll(cleanup);

  it("reminds only members who have not tipped yet", async () => {
    const fixtureId = await scheduledFixture("notif-remind", inMinutes(30));
    // Admin A tips it; member B does not.
    await cA.from("prediction").insert({
      tenant_id: tenantId,
      user_id: uidA,
      fixture_id: fixtureId,
      home_goals: 1,
      away_goals: 0,
    });

    const { sent, sender } = recorder();
    await dispatchNotifications(sender);

    const reminders = sent.filter((s) => s.payload.tag === `reminder-${fixtureId}`);
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.endpoint).toBe("https://push.example/B");
    expect(reminders[0]!.payload.url).toBe(`/${tenantId}/match/${fixtureId}`);
  });

  it("does not re-send a reminder on the next run (ledger dedup)", async () => {
    const fixtureId = await scheduledFixture("notif-dedup", inMinutes(30));
    // Neither member tipped this fixture, so the first run reminds both.
    const first = recorder();
    await dispatchNotifications(first.sender);
    expect(first.sent.filter((s) => s.payload.tag === `reminder-${fixtureId}`)).toHaveLength(2);

    // The ledger now records both — the second run must send nothing for it.
    const second = recorder();
    await dispatchNotifications(second.sender);
    expect(second.sent.filter((s) => s.payload.tag === `reminder-${fixtureId}`)).toHaveLength(0);
  });

  it("does not remind members in a view-only group", async () => {
    await admin.from("tenant").update({ member_tipping_enabled: false }).eq("id", tenantId);
    const fixtureId = await scheduledFixture("notif-viewonly", inMinutes(30));

    const { sent, sender } = recorder();
    await dispatchNotifications(sender);
    expect(sent.filter((s) => s.payload.tag === `reminder-${fixtureId}`)).toHaveLength(0);

    await admin.from("tenant").update({ member_tipping_enabled: true }).eq("id", tenantId);
  });

  it("sends a result push with the member's own points", async () => {
    const fixtureId = await scheduledFixture("notif-result", inMinutes(60));
    await cA.from("prediction").insert({
      tenant_id: tenantId,
      user_id: uidA,
      fixture_id: fixtureId,
      home_goals: 2,
      away_goals: 1,
    });
    await cB.from("prediction").insert({
      tenant_id: tenantId,
      user_id: uidB,
      fixture_id: fixtureId,
      home_goals: 0,
      away_goals: 0,
    });
    // Finish it in the past and score it.
    await admin
      .from("fixture")
      .update({
        status: "finished",
        regular_home: 2,
        regular_away: 1,
        winner_team_id: teamHome,
        kickoff_at: inMinutes(-120),
      })
      .eq("id", fixtureId);
    const { error } = await admin.rpc("score_fixture", { p_fixture: fixtureId });
    expect(error).toBeNull();

    const { sent, sender } = recorder();
    const report = await dispatchNotifications(sender);

    const results = sent.filter((s) => s.payload.tag === `result-${fixtureId}`);
    expect(results).toHaveLength(2);
    expect(report.results).toBeGreaterThanOrEqual(2);

    const toA = results.find((r) => r.endpoint === "https://push.example/A");
    const toB = results.find((r) => r.endpoint === "https://push.example/B");
    expect(toA!.payload.body).toContain("Volltreffer"); // exact 2:1
    expect(toB!.payload.body).toContain("0 Punkte"); // 0:0 miss
  });

  it("prunes a subscription the push service reports as gone", async () => {
    await admin
      .from("push_subscription")
      .insert({ user_id: uidB, endpoint: "https://push.example/dead", p256dh: "x", auth: "y" });
    await scheduledFixture("notif-prune", inMinutes(30));

    const { sender } = recorder("gone");
    await dispatchNotifications(sender);

    const { data } = await admin
      .from("push_subscription")
      .select("endpoint")
      .eq("endpoint", "https://push.example/dead");
    expect(data).toEqual([]);
  });
});
