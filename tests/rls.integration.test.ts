import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, createSignedInUser, deleteUserByEmail, hasSupabase } from "./helpers";

const suite = hasSupabase ? describe : describe.skip;

const EMAILS = {
  a: "itest_admin@example.com",
  b: "itest_member@example.com",
  c: "itest_outsider@example.com",
};
const GROUP_NAME = "Integration Test";
const SOLO_GROUP_NAME = "Solo";
const INVITE_CODE = "ITESTCODE";
const FIXTURE_PROVIDER = "itest";

suite("RLS, deadline and scoring (integration)", () => {
  // Created in beforeAll, not here: describe.skip still runs this body, and
  // adminClient() throws without Supabase env (CI), which would fail the suite
  // instead of skipping it.
  let admin: SupabaseClient;
  let cA: SupabaseClient;
  let cB: SupabaseClient;
  let cC: SupabaseClient;
  let uidA: string;
  let uidB: string;
  let tenantId: string;
  let futureFixtureId: string;
  let pastFixtureId: string;
  let tippingFixtureId: string;

  async function cleanup() {
    await admin.from("tenant").delete().in("name", [GROUP_NAME, SOLO_GROUP_NAME]);
    await admin.from("fixture").delete().eq("provider", FIXTURE_PROVIDER);
    await Promise.all([
      deleteUserByEmail(EMAILS.a),
      deleteUserByEmail(EMAILS.b),
      deleteUserByEmail(EMAILS.c),
      deleteUserByEmail("itest_solo@example.com"),
    ]);
  }

  beforeAll(async () => {
    admin = adminClient();
    await cleanup();

    // create_group honours the global group-creation toggle; ensure it is on so
    // this suite is independent of whatever the ambient app setting happens to be.
    await admin
      .from("app_setting")
      .update({ value: { enabled: true } })
      .eq("key", "group_creation_enabled");

    ({ client: cA, userId: uidA } = await createSignedInUser(EMAILS.a, "password123"));
    ({ client: cB, userId: uidB } = await createSignedInUser(EMAILS.b, "password123"));
    ({ client: cC } = await createSignedInUser(EMAILS.c, "password123"));

    const { data: tenant, error } = await cA.rpc("create_group", {
      p_name: GROUP_NAME,
    });
    if (error) throw error;
    tenantId = tenant.id;

    const { data: season } = await admin
      .from("season")
      .select("id")
      .eq("provider", "openfootball")
      .eq("external_id", "wc-2026")
      .single();
    const { data: teams } = await admin
      .from("team")
      .select("id")
      .eq("provider", "openfootball")
      .limit(2);
    const [teamHome, teamAway] = (teams ?? []).map((t) => t.id);

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const baseFixture = {
      season_id: season!.id,
      home_team_id: teamHome,
      away_team_id: teamAway,
      status: "scheduled" as const,
      provider: FIXTURE_PROVIDER,
    };
    const { data: ff } = await admin
      .from("fixture")
      .insert({ ...baseFixture, kickoff_at: future, external_id: "itest-future" })
      .select("id")
      .single();
    futureFixtureId = ff!.id;
    const { data: pf } = await admin
      .from("fixture")
      .insert({ ...baseFixture, kickoff_at: past, external_id: "itest-past" })
      .select("id")
      .single();
    pastFixtureId = pf!.id;
    const { data: tf } = await admin
      .from("fixture")
      .insert({ ...baseFixture, kickoff_at: future, external_id: "itest-tipping" })
      .select("id")
      .single();
    tippingFixtureId = tf!.id;

    await cA
      .from("tenant_invite")
      .insert({ tenant_id: tenantId, code: INVITE_CODE, role: "member" });
    const { error: joinError } = await cB.rpc("redeem_invite", { p_code: INVITE_CODE });
    if (joinError) throw joinError;

    // Predictions on the FUTURE fixture (before kickoff — allowed).
    await cA.from("prediction").insert({
      tenant_id: tenantId,
      user_id: uidA,
      fixture_id: futureFixtureId,
      home_goals: 2,
      away_goals: 1,
    });
    await cB.from("prediction").insert({
      tenant_id: tenantId,
      user_id: uidB,
      fixture_id: futureFixtureId,
      home_goals: 1,
      away_goals: 1,
    });
  }, 30_000);

  afterAll(cleanup);

  it("hides a tenant from non-members", async () => {
    const { data } = await cC.from("tenant").select("id").eq("id", tenantId);
    expect(data).toEqual([]);
  });

  it("hides a non-member from creating predictions", async () => {
    const { data: outsiderUser } = await cC.auth.getUser();
    const { error } = await cC.from("prediction").insert({
      tenant_id: tenantId,
      user_id: outsiderUser.user!.id,
      fixture_id: futureFixtureId,
      home_goals: 0,
      away_goals: 0,
    });
    expect(error).not.toBeNull();
  });

  it("keeps predictions secret before kickoff for fellow members", async () => {
    const { data } = await cB
      .from("prediction")
      .select("user_id, home_goals")
      .eq("fixture_id", futureFixtureId);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.user_id).toBe(uidB);
  });

  it("lets admins see all predictions even before kickoff", async () => {
    const { data } = await cA
      .from("prediction")
      .select("user_id")
      .eq("fixture_id", futureFixtureId);
    expect(data).toHaveLength(2);
  });

  it("rejects predictions at/after kickoff via the deadline trigger", async () => {
    const { error } = await cB.from("prediction").insert({
      tenant_id: tenantId,
      user_id: uidB,
      fixture_id: pastFixtureId,
      home_goals: 0,
      away_goals: 0,
    });
    expect(error).not.toBeNull();
  });

  it("reveals all predictions to members once kickoff has passed", async () => {
    await admin
      .from("fixture")
      .update({ kickoff_at: new Date(Date.now() - 3_600_000).toISOString() })
      .eq("id", futureFixtureId);

    const { data } = await cB
      .from("prediction")
      .select("user_id")
      .eq("fixture_id", futureFixtureId);
    expect(data).toHaveLength(2);
  });

  it("scores a finished fixture and ranks the leaderboard", async () => {
    const { data: teams } = await admin
      .from("fixture")
      .select("home_team_id")
      .eq("id", futureFixtureId)
      .single();
    await admin
      .from("fixture")
      .update({
        status: "finished",
        regular_home: 2,
        regular_away: 1,
        winner_team_id: teams!.home_team_id,
      })
      .eq("id", futureFixtureId);
    const { error } = await admin.rpc("score_fixture", { p_fixture: futureFixtureId });
    expect(error).toBeNull();

    const { data: scores } = await admin
      .from("prediction_score")
      .select("user_id, points, category")
      .eq("fixture_id", futureFixtureId);
    const byUser = new Map((scores ?? []).map((s) => [s.user_id, s]));
    // Default rules: exact = 3 (see migration 600).
    expect(byUser.get(uidA)).toMatchObject({ points: 3, category: "exact" });
    expect(byUser.get(uidB)).toMatchObject({ points: 0, category: "miss" });

    const { data: leaderboard } = await cA
      .from("leaderboard")
      .select("user_id, total_points, rank")
      .eq("tenant_id", tenantId)
      .order("rank", { ascending: true });
    expect(leaderboard?.[0]).toMatchObject({ user_id: uidA, total_points: 3, rank: 1 });
  });

  it("matches the SQL scoring function to the TypeScript mirror (rpc parity)", async () => {
    const config = { exact: 4, goal_diff: 3, tendency: 2, advance_bonus: 2, stage_multipliers: {} };
    const { data } = await cA.rpc("score_prediction", {
      p_home: 3,
      p_away: 1,
      p_advancing: null,
      f_home: 2,
      f_away: 0,
      f_winner: null,
      p_stage: "group",
      p_config: config,
    });
    expect(data).toMatchObject({ points: 3, category: "goal_diff" });
  });

  it("view-only mode blocks members but lets admins enter tips for them", async () => {
    // Switch the group to view-only.
    await admin.from("tenant").update({ member_tipping_enabled: false }).eq("id", tenantId);

    // The member can no longer write their own prediction.
    const { error: memberError } = await cB.from("prediction").upsert(
      {
        tenant_id: tenantId,
        user_id: uidB,
        fixture_id: tippingFixtureId,
        home_goals: 1,
        away_goals: 0,
      },
      { onConflict: "tenant_id,user_id,fixture_id" },
    );
    expect(memberError).not.toBeNull();

    // The admin may enter a prediction on the member's behalf.
    const { error: adminError } = await cA.from("prediction").upsert(
      {
        tenant_id: tenantId,
        user_id: uidB,
        fixture_id: tippingFixtureId,
        home_goals: 3,
        away_goals: 2,
      },
      { onConflict: "tenant_id,user_id,fixture_id" },
    );
    expect(adminError).toBeNull();

    // Re-enabling tipping lets the member write again.
    await admin.from("tenant").update({ member_tipping_enabled: true }).eq("id", tenantId);
    const { error: reenabledError } = await cB.from("prediction").upsert(
      {
        tenant_id: tenantId,
        user_id: uidB,
        fixture_id: tippingFixtureId,
        home_goals: 0,
        away_goals: 0,
      },
      { onConflict: "tenant_id,user_id,fixture_id" },
    );
    expect(reenabledError).toBeNull();
  });

  it("delete_own_account blocks a sole admin with members, but deletes a solo owner + their group", async () => {
    // cA is the only admin of the itest group and cB is a member → must be blocked.
    const { error: blocked } = await cA.rpc("delete_own_account");
    expect(blocked).not.toBeNull();
    expect(blocked?.message).toContain("SOLE_ADMIN");
    // cA still exists.
    const { data: stillThere } = await admin.auth.admin.listUsers();
    expect(stillThere.users.some((u) => u.id === uidA)).toBe(true);

    // A fresh user who owns only their own group can delete; the group goes with them.
    const { client: cD, userId: uidD } = await createSignedInUser(
      "itest_solo@example.com",
      "password123",
    );
    const { error: createErr } = await cD.rpc("create_group", {
      p_name: SOLO_GROUP_NAME,
    });
    expect(createErr).toBeNull();

    const { error: delErr } = await cD.rpc("delete_own_account");
    expect(delErr).toBeNull();

    const { data: goneTenant } = await admin
      .from("tenant")
      .select("id")
      .eq("name", SOLO_GROUP_NAME);
    expect(goneTenant).toEqual([]);
    const { data: afterUsers } = await admin.auth.admin.listUsers();
    expect(afterUsers.users.some((u) => u.id === uidD)).toBe(false);
  });
});
