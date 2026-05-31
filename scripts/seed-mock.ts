/**
 * Populate a group with mock players, predictions and finished results so the
 * leaderboard (and post-kickoff tip views) have something to show in local dev.
 *
 * It inserts predictions while each fixture is still in the future (the deadline
 * trigger requires that), THEN backdates those fixtures, sets a result, and
 * scores them — yielding a realistic ranking. DEV ONLY: refuses to run against
 * anything but a local Supabase, and creates throwaway @tippkeks.test users.
 *
 * Run: pnpm tsx scripts/seed-mock.ts [group-slug]   (default: fg-2026)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local" });
config({ path: ".env" });

const MOCK_NAMES = ["Lena", "Jonas", "Mia", "Paul", "Sophie", "Tom"];
const FIXTURE_COUNT = 10;

const randInt = (max: number) => Math.floor(Math.random() * (max + 1));
const clamp = (n: number) => Math.max(0, Math.min(9, n));

/** A plausible tip for a result: sometimes exact, sometimes near, sometimes off. */
function predict(rh: number, ra: number): [number, number] {
  const r = Math.random();
  if (r < 0.3) return [rh, ra];
  if (r < 0.6)
    return [clamp(rh + (Math.random() < 0.5 ? -1 : 1)), clamp(ra + (Math.random() < 0.5 ? -1 : 1))];
  return [randInt(3), randInt(3)];
}

async function main() {
  const slug = process.argv[2] ?? "fg-2026";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exitCode = 1;
    return;
  }
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    console.error(`Refusing to seed mock data against non-local Supabase: ${url}`);
    process.exitCode = 1;
    return;
  }

  const db: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the target group.
  const { data: tenant } = await db
    .from("tenant")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) {
    console.error(`Group "${slug}" not found. Create it in the app first.`);
    process.exitCode = 1;
    return;
  }

  // Ensure the mock players exist and belong to the group.
  for (let i = 0; i < MOCK_NAMES.length; i++) {
    const name = MOCK_NAMES[i]!;
    const email = `mock${i + 1}@tippkeks.test`;
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) {
      const { data: created, error } = await db.auth.admin.createUser({
        email,
        password: "mock-password-123",
        email_confirm: true,
        user_metadata: { display_name: name },
      });
      if (error || !created.user) throw error ?? new Error(`Failed to create ${email}`);
      userId = created.user.id;
    }
    await db
      .from("tenant_member")
      .upsert(
        { tenant_id: tenant.id, user_id: userId, role: "member" },
        { onConflict: "tenant_id,user_id" },
      );
  }

  // Everyone in the group (mock players + the real members) gets tips.
  const { data: members } = await db
    .from("tenant_member")
    .select("user_id")
    .eq("tenant_id", tenant.id);
  const memberIds = (members ?? []).map((m) => m.user_id);

  // Seasons the group plays, and the next scheduled fixtures with both teams known.
  const { data: seasons } = await db
    .from("tenant_season")
    .select("season_id")
    .eq("tenant_id", tenant.id);
  const seasonIds = (seasons ?? []).map((s) => s.season_id);
  const { data: fixtures } = await db
    .from("fixture")
    .select("id, home_team_id, away_team_id")
    .in("season_id", seasonIds)
    .eq("status", "scheduled")
    .not("home_team_id", "is", null)
    .not("away_team_id", "is", null)
    .order("kickoff_at", { ascending: true })
    .limit(FIXTURE_COUNT);

  if (!fixtures?.length) {
    console.log("No schedulable fixtures left to mock (already seeded?). Nothing to do.");
    return;
  }

  const now = Date.now();
  let scored = 0;
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i]!;
    const rh = randInt(3);
    const ra = randInt(3);

    // 1) Tips first — must be inserted while the fixture is still in the future.
    const predictions = memberIds.map((user_id) => {
      const [home_goals, away_goals] = predict(rh, ra);
      return { tenant_id: tenant.id, user_id, fixture_id: f.id, home_goals, away_goals };
    });
    const { error: predError } = await db
      .from("prediction")
      .upsert(predictions, { onConflict: "tenant_id,user_id,fixture_id" });
    if (predError) throw predError;

    // 2) Backdate the fixture and record the result.
    const winner = rh > ra ? f.home_team_id : ra > rh ? f.away_team_id : null;
    const kickoff = new Date(now - (i + 1) * 86_400_000 - 3_600_000).toISOString();
    const { error: fixError } = await db
      .from("fixture")
      .update({
        status: "finished",
        regular_home: rh,
        regular_away: ra,
        after_extra_time: false,
        winner_team_id: winner,
        kickoff_at: kickoff,
      })
      .eq("id", f.id);
    if (fixError) throw fixError;

    // 3) Score it.
    const { error: scoreError } = await db.rpc("score_fixture", { p_fixture: f.id });
    if (scoreError) throw scoreError;
    scored++;
  }

  console.log(
    `[seed-mock] group="${tenant.name}" players=${memberIds.length} fixtures=${scored} scored. Leaderboard is ready.`,
  );
}

main().catch((error) => {
  console.error("[seed-mock] failed:", error);
  process.exitCode = 1;
});
