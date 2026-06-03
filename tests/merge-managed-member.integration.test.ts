import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { adminClient, createSignedInUser, deleteUserByEmail, hasSupabase } from "./helpers";

const suite = hasSupabase ? describe : describe.skip;

const ADMIN_EMAIL = "itest_merge_admin@example.com";
const TARGET_EMAIL = "itest_merge_target@example.com";
const MANAGED_EMAIL = "merge-managed-itest@managed.tippkeks.de";
const GROUP_NAME = "Merge Managed Test";
const FIXTURE_PROVIDER = "itest-merge";

/**
 * Exercises merge_managed_member: a managed member with scored tips on PAST
 * fixtures is merged into an existing real account. Covers the conflict policy
 * (managed tip wins), the deadline-trigger refinement (an ownership move past
 * kickoff is allowed while a content change is still blocked), and placeholder
 * deletion.
 */
suite("merge managed member (integration)", () => {
  let admin: SupabaseClient;
  let cAdmin: SupabaseClient;
  let tenantId: string;
  let managedUserId: string;
  let targetUserId: string;
  let fixtureConflictId: string; // both managed + target tipped this one
  let fixtureSoloId: string; // only the managed member tipped this one

  async function cleanup() {
    await admin.from("tenant").delete().eq("name", GROUP_NAME);
    await admin.from("fixture").delete().eq("provider", FIXTURE_PROVIDER);
    await Promise.all([
      deleteUserByEmail(ADMIN_EMAIL),
      deleteUserByEmail(TARGET_EMAIL),
      deleteUserByEmail(MANAGED_EMAIL),
    ]);
  }

  beforeAll(async () => {
    admin = adminClient();
    await cleanup();

    await admin
      .from("app_setting")
      .update({ value: { enabled: true } })
      .eq("key", "group_creation_enabled");

    ({ client: cAdmin } = await createSignedInUser(ADMIN_EMAIL, "password123"));
    const { data: tenant, error } = await cAdmin.rpc("create_group", { p_name: GROUP_NAME });
    if (error) throw error;
    tenantId = tenant.id;

    // Managed member (synthetic, flagged, member of the group).
    const { data: managed, error: mErr } = await admin.auth.admin.createUser({
      email: MANAGED_EMAIL,
      email_confirm: true,
      user_metadata: { display_name: "Platzhalter" },
    });
    if (mErr || !managed.user) throw mErr ?? new Error("managed createUser failed");
    managedUserId = managed.user.id;
    await admin.from("profile").update({ managed: true }).eq("user_id", managedUserId);
    await admin
      .from("tenant_member")
      .insert({ tenant_id: tenantId, user_id: managedUserId, role: "member" });

    // Target real account, already a member with its own tip on the conflict fixture.
    const { data: target, error: tErr } = await admin.auth.admin.createUser({
      email: TARGET_EMAIL,
      password: "password123",
      email_confirm: true,
      user_metadata: { display_name: "Echtes Konto" },
    });
    if (tErr || !target.user) throw tErr ?? new Error("target createUser failed");
    targetUserId = target.user.id;
    await admin
      .from("tenant_member")
      .insert({ tenant_id: tenantId, user_id: targetUserId, role: "member" });

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

    // Two fixtures, created in the FUTURE so tips can be inserted before kickoff.
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const mk = async (externalId: string) => {
      const { data, error: fErr } = await admin
        .from("fixture")
        .insert({
          season_id: season!.id,
          home_team_id: teamHome,
          away_team_id: teamAway,
          status: "scheduled",
          provider: FIXTURE_PROVIDER,
          external_id: externalId,
          kickoff_at: future,
        })
        .select("id")
        .single();
      if (fErr || !data) throw fErr ?? new Error("fixture insert failed");
      return data.id as string;
    };
    fixtureConflictId = await mk("itest-merge-conflict");
    fixtureSoloId = await mk("itest-merge-solo");

    // Tips (while still future). Managed tips both; target tips only the conflict one.
    await admin.from("prediction").insert([
      {
        tenant_id: tenantId,
        user_id: managedUserId,
        fixture_id: fixtureConflictId,
        home_goals: 2,
        away_goals: 1,
      }, // managed should win this fixture
      {
        tenant_id: tenantId,
        user_id: managedUserId,
        fixture_id: fixtureSoloId,
        home_goals: 3,
        away_goals: 0,
      },
      {
        tenant_id: tenantId,
        user_id: targetUserId,
        fixture_id: fixtureConflictId,
        home_goals: 0,
        away_goals: 0,
      }, // dropped on merge
    ]);

    // Backdate both to the past, set results, and score them.
    for (const id of [fixtureConflictId, fixtureSoloId]) {
      await admin
        .from("fixture")
        .update({
          status: "finished",
          regular_home: 2,
          regular_away: 1,
          after_extra_time: false,
          winner_team_id: teamHome,
          kickoff_at: new Date(Date.now() - 86_400_000).toISOString(),
        })
        .eq("id", id);
      const { error: sErr } = await admin.rpc("score_fixture", { p_fixture: id });
      if (sErr) throw sErr;
    }
  }, 30_000);

  afterAll(cleanup);

  it("still blocks a late CONTENT change to a past prediction (deadline intact)", async () => {
    const { error } = await admin
      .from("prediction")
      .update({ home_goals: 9 })
      .eq("tenant_id", tenantId)
      .eq("user_id", managedUserId)
      .eq("fixture_id", fixtureSoloId);
    expect(error).not.toBeNull();
  });

  it("rejects merging onto an account that is not a member of the group", async () => {
    // A tenant admin must not be able to pull a non-consenting stranger into the
    // group (and overwrite their tips) by targeting their email.
    const OUTSIDER_EMAIL = "itest_merge_outsider@example.com";
    await deleteUserByEmail(OUTSIDER_EMAIL);
    const { data: outsider, error: oErr } = await admin.auth.admin.createUser({
      email: OUTSIDER_EMAIL,
      password: "password123",
      email_confirm: true,
    });
    if (oErr || !outsider.user) throw oErr ?? new Error("outsider createUser failed");

    const { error } = await admin.rpc("merge_managed_member", {
      p_tenant: tenantId,
      p_managed_user: managedUserId,
      p_target_email: OUTSIDER_EMAIL,
    });
    expect(error).not.toBeNull();

    // The outsider was not added to the group and the placeholder survives.
    const { count: memberCount } = await admin
      .from("tenant_member")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", outsider.user.id);
    expect(memberCount).toBe(0);
    const { data: stillThere } = await admin.auth.admin.getUserById(managedUserId);
    expect(stillThere.user).not.toBeNull();

    await deleteUserByEmail(OUTSIDER_EMAIL);
  });

  it("merges the placeholder's tips into the existing account and deletes it", async () => {
    const { error } = await admin.rpc("merge_managed_member", {
      p_tenant: tenantId,
      p_managed_user: managedUserId,
      p_target_email: TARGET_EMAIL,
    });
    expect(error).toBeNull();

    // Placeholder auth user is gone.
    const { data: gone } = await admin.auth.admin.getUserById(managedUserId);
    expect(gone.user).toBeNull();

    // No predictions or scores remain under the placeholder.
    const { count: predLeft } = await admin
      .from("prediction")
      .select("id", { count: "exact", head: true })
      .eq("user_id", managedUserId);
    expect(predLeft).toBe(0);
    const { count: scoreLeft } = await admin
      .from("prediction_score")
      .select("prediction_id", { count: "exact", head: true })
      .eq("user_id", managedUserId);
    expect(scoreLeft).toBe(0);
  });

  it("applies the conflict policy (managed tip wins) and moves the solo tip", async () => {
    // Conflict fixture: exactly one tip for the target, and it is the managed 2:1.
    const { data: conflict } = await admin
      .from("prediction")
      .select("home_goals, away_goals")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .eq("fixture_id", fixtureConflictId);
    expect(conflict).toEqual([{ home_goals: 2, away_goals: 1 }]);

    // Solo fixture: the managed tip now belongs to the target.
    const { data: solo } = await admin
      .from("prediction")
      .select("home_goals, away_goals")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .eq("fixture_id", fixtureSoloId)
      .single();
    expect(solo).toEqual({ home_goals: 3, away_goals: 0 });

    // Both moved predictions kept their scores under the target.
    const { count } = await admin
      .from("prediction_score")
      .select("prediction_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId);
    expect(count).toBe(2);
  });
});
