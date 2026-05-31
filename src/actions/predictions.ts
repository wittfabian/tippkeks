"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import type { ActionState } from "@/actions/types";

const schema = z.object({
  tenantId: z.string().uuid(),
  slug: z.string().min(1),
  fixtureId: z.coerce.number().int().positive(),
  homeGoals: z.coerce.number().int().min(0).max(99),
  awayGoals: z.coerce.number().int().min(0).max(99),
  advancingTeamId: z.coerce.number().int().positive().optional(),
});

/**
 * Upsert the current user's prediction for a fixture. The DB deadline trigger
 * rejects writes at/after kickoff (the real lock), and RLS guarantees a user
 * can only write their own prediction within their tenant.
 */
export async function submitPredictionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const advancingRaw = formData.get("advancingTeamId");
  const parsed = schema.safeParse({
    tenantId: formData.get("tenantId"),
    slug: formData.get("slug"),
    fixtureId: formData.get("fixtureId"),
    homeGoals: formData.get("homeGoals"),
    awayGoals: formData.get("awayGoals"),
    advancingTeamId: advancingRaw === null || advancingRaw === "" ? undefined : advancingRaw,
  });
  if (!parsed.success) return { error: de.fixtures.saveError };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: de.fixtures.saveError };

  const { error } = await supabase.from("prediction").upsert(
    {
      tenant_id: parsed.data.tenantId,
      user_id: userId,
      fixture_id: parsed.data.fixtureId,
      home_goals: parsed.data.homeGoals,
      away_goals: parsed.data.awayGoals,
      advancing_team_id: parsed.data.advancingTeamId ?? null,
    },
    { onConflict: "tenant_id,user_id,fixture_id" },
  );
  if (error) return { error: de.fixtures.saveError };

  revalidatePath(`/${parsed.data.slug}/spiele`);
  return { error: null, info: de.fixtures.saved };
}
