import "server-only";

import { cached } from "@/lib/cache/cache";
import { createServiceClient } from "@/lib/supabase/service";

export interface TipPulse {
  /** How many predictions exist per fixture id, for this tenant. */
  counts: Record<string, number>;
  /** Total members of the tenant (the denominator, incl. managed members). */
  members: number;
}

/**
 * Per-fixture "how many have tipped" counts for a tenant — the pre-kickoff
 * group signal ("5 von 8 haben getippt"). The numbers are identical for every
 * member (tenant-uniform), so this is cached per tenant under tags "tip-pulse" +
 * "tip-pulse:<id>", invalidated when a prediction is written (member or admin).
 *
 * Read with the service role and the `tenant_id` filter scopes it — but we
 * select ONLY `fixture_id`, never the goals, so this can never leak a tip's
 * content before kickoff (the secrecy invariant). It is a bare aggregate count.
 */
export async function getTipPulse(tenantId: string): Promise<TipPulse> {
  return cached(
    {
      key: `tip-pulse:${tenantId}`,
      ttlSeconds: 30,
      tags: ["tip-pulse", `tip-pulse:${tenantId}`],
    },
    async () => {
      const service = createServiceClient();
      const [{ data: predictions }, { count: members }] = await Promise.all([
        service.from("prediction").select("fixture_id").eq("tenant_id", tenantId),
        service
          .from("tenant_member")
          .select("user_id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
      ]);
      const counts: Record<string, number> = {};
      for (const p of predictions ?? []) {
        counts[p.fixture_id] = (counts[p.fixture_id] ?? 0) + 1;
      }
      return { counts, members: members ?? 0 };
    },
  );
}
