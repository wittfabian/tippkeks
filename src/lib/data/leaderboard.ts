import "server-only";

import { cached } from "@/lib/cache/cache";
import { createServiceClient } from "@/lib/supabase/service";

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_count: number;
  hit_count: number;
  rank: number;
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
      const { data } = await service
        .from("leaderboard")
        .select("user_id, display_name, total_points, exact_count, hit_count, rank")
        .eq("tenant_id", tenantId)
        .order("rank", { ascending: true });
      return (data ?? []) as LeaderboardRow[];
    },
  );
}
