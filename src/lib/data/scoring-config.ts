import "server-only";

import type { ServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/lib/scoring/engine";

/**
 * A tenant's active scoring config, merged onto the defaults. Used for the live
 * in-match projection (display only) — the authoritative scores still come from
 * the SQL `score_fixture`. Members may read their tenant's rule set (RLS), so
 * this goes through the caller's cookie-aware client, not the service role.
 */
export async function getScoringConfig(
  supabase: ServerClient,
  tenantId: string,
): Promise<ScoringConfig> {
  const { data } = await supabase
    .from("scoring_rule_set")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  const cfg = (data?.config ?? {}) as Partial<ScoringConfig>;
  return {
    ...DEFAULT_SCORING_CONFIG,
    ...cfg,
    stage_multipliers: {
      ...DEFAULT_SCORING_CONFIG.stage_multipliers,
      ...(cfg.stage_multipliers ?? {}),
    },
  };
}
