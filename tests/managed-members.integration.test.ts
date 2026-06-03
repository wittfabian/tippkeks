import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  adminClient,
  createSignedInUser,
  deleteUserByEmail,
  hasSupabase,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./helpers";
import { createClient } from "@supabase/supabase-js";

const suite = hasSupabase ? describe : describe.skip;

const ADMIN_EMAIL = "itest_mm_admin@example.com";
// Mirrors createManagedMemberAction: a synthetic, non-deliverable address.
const MANAGED_EMAIL = "managed-itest@managed.tippkeks.de";
const GROUP_NAME = "Managed Member Test";
const FIXTURE_PROVIDER = "itest-mm";

suite("managed members (integration)", () => {
  let admin: SupabaseClient;
  let cAdmin: SupabaseClient;
  let tenantId: string;
  let managedUserId: string;
  let futureFixtureId: string;

  async function cleanup() {
    await admin.from("tenant").delete().eq("name", GROUP_NAME);
    await admin.from("fixture").delete().eq("provider", FIXTURE_PROVIDER);
    await Promise.all([deleteUserByEmail(ADMIN_EMAIL), deleteUserByEmail(MANAGED_EMAIL)]);
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

    // Provision the managed member exactly as createManagedMemberAction does:
    // an auth user with a synthetic email and NO password, flagged managed, then
    // added as a tenant member.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: MANAGED_EMAIL,
      email_confirm: true,
      user_metadata: { display_name: "Oma Erna" },
    });
    if (createError || !created.user) throw createError ?? new Error("createUser failed");
    managedUserId = created.user.id;
    await admin.from("profile").update({ managed: true }).eq("user_id", managedUserId);
    await admin
      .from("tenant_member")
      .insert({ tenant_id: tenantId, user_id: managedUserId, role: "member" });

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
    const { data: ff } = await admin
      .from("fixture")
      .insert({
        season_id: season!.id,
        home_team_id: teamHome,
        away_team_id: teamAway,
        status: "scheduled",
        provider: FIXTURE_PROVIDER,
        external_id: "itest-mm-future",
        kickoff_at: future,
      })
      .select("id")
      .single();
    futureFixtureId = ff!.id;
  }, 30_000);

  afterAll(cleanup);

  it("flags the profile as managed with the admin-given display name", async () => {
    const { data } = await admin
      .from("profile")
      .select("display_name, managed")
      .eq("user_id", managedUserId)
      .single();
    expect(data?.managed).toBe(true);
    expect(data?.display_name).toBe("Oma Erna");
  });

  it("lets a group admin enter a prediction for the managed member (RLS)", async () => {
    const { error } = await cAdmin.from("prediction").insert({
      tenant_id: tenantId,
      user_id: managedUserId,
      fixture_id: futureFixtureId,
      home_goals: 3,
      away_goals: 0,
    });
    expect(error).toBeNull();

    const { data } = await cAdmin
      .from("prediction")
      .select("home_goals, away_goals")
      .eq("tenant_id", tenantId)
      .eq("user_id", managedUserId)
      .eq("fixture_id", futureFixtureId)
      .single();
    expect(data).toEqual({ home_goals: 3, away_goals: 0 });
  });

  // Backs convertManagedMemberAction's pre-check: assigning a real email that is
  // already taken must fail clearly rather than as a raw GoTrue 500.
  it("email_in_use reports an existing address case-insensitively (service role)", async () => {
    const exact = await admin.rpc("email_in_use", { p_email: ADMIN_EMAIL });
    expect(exact.error).toBeNull();
    expect(exact.data).toBe(true);

    const upper = await admin.rpc("email_in_use", { p_email: ADMIN_EMAIL.toUpperCase() });
    expect(upper.data).toBe(true);

    const unknown = await admin.rpc("email_in_use", {
      p_email: "definitely-not-here-itest@example.com",
    });
    expect(unknown.data).toBe(false);
  });

  it("email_in_use is not callable by an authenticated user (no email enumeration)", async () => {
    const { error } = await cAdmin.rpc("email_in_use", { p_email: ADMIN_EMAIL });
    expect(error).not.toBeNull();
  });

  it("cannot sign in (no password set)", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: MANAGED_EMAIL,
      password: "password123",
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });
});
