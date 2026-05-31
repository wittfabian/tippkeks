import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, createSignedInUser, deleteUserByEmail, hasSupabase } from "./helpers";

const suite = hasSupabase ? describe : describe.skip;

const EMAILS = {
  a: "itest_admin@example.com",
  b: "itest_member@example.com",
  c: "itest_outsider@example.com",
};
const SLUG = "itest-group";
const INVITE_CODE = "ITESTCODE";
const FIXTURE_PROVIDER = "itest";

suite("RLS, deadline and scoring (integration)", () => {
  const admin = adminClient();
  let cA: SupabaseClient;
  let cB: SupabaseClient;
  let cC: SupabaseClient;
  let uidA: string;
  let uidB: string;
  let tenantId: string;
  let futureFixtureId: number;
  let pastFixtureId: number;

  async function cleanup() {
    await admin.from("tenant").delete().eq("slug", SLUG);
    await admin.from("fixture").delete().eq("provider", FIXTURE_PROVIDER);
    await Promise.all([
      deleteUserByEmail(EMAILS.a),
      deleteUserByEmail(EMAILS.b),
      deleteUserByEmail(EMAILS.c),
    ]);
  }

  beforeAll(async () => {
    await cleanup();

    ({ client: cA, userId: uidA } = await createSignedInUser(EMAILS.a, "password123"));
    ({ client: cB, userId: uidB } = await createSignedInUser(EMAILS.b, "password123"));
    ({ client: cC } = await createSignedInUser(EMAILS.c, "password123"));

    const { data: tenant, error } = await cA.rpc("create_group", {
      p_name: "Integration Test",
      p_slug: SLUG,
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

    await cA
      .from("tenant_invite")
      .insert({ tenant_id: tenantId, code: INVITE_CODE, role: "member" });
    const { error: joinError } = await cB.rpc("redeem_invite", { p_code: INVITE_CODE });
    if (joinError) throw joinError;

    // Predictions on the FUTURE fixture (before kickoff — allowed).
    await cA
      .from("prediction")
      .insert({
        tenant_id: tenantId,
        user_id: uidA,
        fixture_id: futureFixtureId,
        home_goals: 2,
        away_goals: 1,
      });
    await cB
      .from("prediction")
      .insert({
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
    expect(byUser.get(uidA)).toMatchObject({ points: 4, category: "exact" });
    expect(byUser.get(uidB)).toMatchObject({ points: 0, category: "miss" });

    const { data: leaderboard } = await cA
      .from("leaderboard")
      .select("user_id, total_points, rank")
      .eq("tenant_id", tenantId)
      .order("rank", { ascending: true });
    expect(leaderboard?.[0]).toMatchObject({ user_id: uidA, total_points: 4, rank: 1 });
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
});
