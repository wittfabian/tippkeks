import "server-only";

import { cached } from "@/lib/cache/cache";
import { createServiceClient } from "@/lib/supabase/service";

export interface MatchdayRecap {
  /** The most recent matchday that has finished, scored fixtures. */
  matchday: number;
  /** Who scored the most points that matchday (the "Tagessieger"). */
  winner: { name: string; points: number } | null;
  /** Total exact-hit predictions across the group that matchday. */
  exactHits: number;
  /** How many fixtures of that matchday are finished + scored. */
  fixtures: number;
}

/**
 * A short recap of the most recently completed matchday — Tagessieger + how the
 * group did. Derived from already-public scored results, tenant-uniform, cached
 * under the SAME tags as the leaderboard so it refreshes whenever scores change.
 * "Aufsteiger des Tages" (rank movement) is intentionally omitted — that needs a
 * per-day snapshot baseline (a schema change), out of scope here.
 */
export async function getMatchdayRecap(tenantId: string): Promise<MatchdayRecap | null> {
  return cached(
    {
      key: `recap:${tenantId}`,
      ttlSeconds: 60,
      tags: ["leaderboard", `leaderboard:${tenantId}`],
    },
    async () => {
      const service = createServiceClient();
      const { data: scores } = await service
        .from("prediction_score")
        .select("user_id, points, category, fixture_id")
        .eq("tenant_id", tenantId);
      if (!scores || scores.length === 0) return null;

      const fixtureIds = [...new Set(scores.map((s) => s.fixture_id))];
      const { data: fixtures } = await service
        .from("fixture")
        .select("id, matchday, status")
        .in("id", fixtureIds);
      const matchdayById = new Map<string, number>();
      for (const f of fixtures ?? []) {
        if (f.status === "finished" && f.matchday != null) matchdayById.set(f.id, f.matchday);
      }
      const matchdays = [...matchdayById.values()];
      if (matchdays.length === 0) return null;
      const matchday = Math.max(...matchdays);

      const pointsByUser = new Map<string, number>();
      const fixtureSet = new Set<string>();
      let exactHits = 0;
      for (const s of scores) {
        if (matchdayById.get(s.fixture_id) !== matchday) continue;
        pointsByUser.set(s.user_id, (pointsByUser.get(s.user_id) ?? 0) + s.points);
        fixtureSet.add(s.fixture_id);
        if (s.category === "exact") exactHits++;
      }

      const top = [...pointsByUser.entries()].sort((a, b) => b[1] - a[1])[0];
      let winner: MatchdayRecap["winner"] = null;
      if (top) {
        const { data: profile } = await service
          .from("profile")
          .select("display_name")
          .eq("user_id", top[0])
          .maybeSingle();
        winner = { name: profile?.display_name ?? "—", points: top[1] };
      }

      return { matchday, winner, exactHits, fixtures: fixtureSet.size };
    },
  );
}
