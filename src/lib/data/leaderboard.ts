import "server-only";

import { cached } from "@/lib/cache/cache";
import { summariseForm } from "@/lib/domain/form";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * One leaderboard row. The DB view types every column as nullable (Postgres
 * can't prove non-null through a view), but a real ranked row always has these
 * values — so we coalesce at the data boundary and expose a clean non-null shape
 * downstream rather than leaking the view's nullability via an `as` cast.
 */
export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_count: number;
  hit_count: number;
  rank: number;
}

export interface MemberForm {
  user_id: string;
  /** Up to 5 most recent scored predictions, oldest → newest. */
  recent: ("hit" | "miss")[];
  /** Consecutive hits ending at the most recent scored match (0 if it missed). */
  streak: number;
}

/**
 * A tenant's leaderboard, ranked. The rows are identical for every member of
 * the tenant (not per-user-secret), so this is cached per tenant under tags
 * "leaderboard" + "leaderboard:<id>", invalidated when scores change (sync,
 * result override, scoring-rule recompute). Read with the service role since
 * the leaderboard view is security_invoker; the `tenant_id` filter scopes it.
 */
export async function getLeaderboard(tenantId: string): Promise<LeaderboardRow[]> {
  return cached(
    {
      key: `leaderboard:${tenantId}`,
      ttlSeconds: 60,
      tags: ["leaderboard", `leaderboard:${tenantId}`],
    },
    async () => {
      const service = createServiceClient();
      const { data, error } = await service
        .from("leaderboard")
        .select("user_id, display_name, total_points, exact_count, hit_count, rank")
        .eq("tenant_id", tenantId)
        .order("rank", { ascending: true });
      // Throw rather than cache a degraded result (see getTournamentData).
      if (error) throw new Error(`[data:leaderboard] query failed: ${error.message}`);
      // flatMap drops any row with a null user_id (shouldn't occur) and narrows
      // user_id to string in the kept branch, so no non-null cast is needed.
      return (data ?? []).flatMap((row) =>
        row.user_id == null
          ? []
          : [
              {
                user_id: row.user_id,
                display_name: row.display_name ?? "—",
                total_points: row.total_points ?? 0,
                exact_count: row.exact_count ?? 0,
                hit_count: row.hit_count ?? 0,
                rank: row.rank ?? 0,
              },
            ],
      );
    },
  );
}

/**
 * Per-member recent form: the last 5 scored predictions as hit/miss plus the
 * current hit streak. Derived from already-public scored results (not secret
 * tips), so it is tenant-uniform and cached under the SAME tags as the
 * leaderboard — the sync job and result overrides that invalidate "leaderboard"
 * refresh the form in lockstep. Read with the service role; `tenant_id` scopes.
 */
export async function getLeaderboardForm(tenantId: string): Promise<MemberForm[]> {
  return cached(
    {
      key: `leaderboard-form:${tenantId}`,
      ttlSeconds: 60,
      tags: ["leaderboard", `leaderboard:${tenantId}`],
    },
    async () => {
      const service = createServiceClient();
      const { data: scores, error } = await service
        .from("prediction_score")
        .select("user_id, fixture_id, category")
        .eq("tenant_id", tenantId);
      // Throw rather than cache a degraded result (see getTournamentData).
      if (error) throw new Error(`[data:leaderboard-form] query failed: ${error.message}`);
      if (!scores || scores.length === 0) return [];

      const fixtureIds = [...new Set(scores.map((s) => s.fixture_id))];
      const { data: fixtures, error: fixtureError } = await service
        .from("fixture")
        .select("id, kickoff_at")
        .in("id", fixtureIds);
      if (fixtureError)
        throw new Error(`[data:leaderboard-form] fixture query failed: ${fixtureError.message}`);
      const kickoffById = new Map((fixtures ?? []).map((f) => [f.id, f.kickoff_at]));

      // Collect each member's scored results; summariseForm sorts + reduces them.
      const byUser = new Map<string, { kickoff: string; hit: boolean }[]>();
      for (const s of scores) {
        const kickoff = kickoffById.get(s.fixture_id);
        if (!kickoff) continue;
        const list = byUser.get(s.user_id) ?? [];
        list.push({ kickoff, hit: s.category !== "miss" });
        byUser.set(s.user_id, list);
      }

      return [...byUser.entries()].map(([user_id, results]) => ({
        user_id,
        ...summariseForm(results),
      }));
    },
  );
}
