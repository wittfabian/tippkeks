"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invalidateTags } from "@/lib/cache/cache";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";
import { logActionError, type ActionState } from "@/actions/types";

// z.coerce.number() turns "" into 0, so a blank goal field would silently save a
// 0:0 tip. The visible inputs guard this client-side via `required`, but the
// action is the trust boundary — require 1–2 digits explicitly (which also bounds
// the value to 0–99) and reject blank/missing/non-numeric.
const goals = z
  .string()
  .trim()
  .regex(/^\d{1,2}$/)
  .transform(Number);

const schema = z.object({
  tenantId: z.string().uuid(),
  fixtureId: z.string().uuid(),
  homeGoals: goals,
  awayGoals: goals,
  advancingTeamId: z.string().uuid().optional(),
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

  // View-only mode: members can't tip when the group has it disabled (admins
  // always can). RLS enforces this too; this returns a friendlier message.
  const [{ data: tenant }, { data: member }] = await Promise.all([
    supabase
      .from("tenant")
      .select("member_tipping_enabled")
      .eq("id", parsed.data.tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_member")
      .select("role")
      .eq("tenant_id", parsed.data.tenantId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  // Re-resolve membership at the trust boundary (RLS is the final gate, but the
  // action should not lean on it alone): a non-member has no business writing here.
  if (!member) return { error: de.fixtures.saveError };
  if (member.role !== "admin" && tenant && !tenant.member_tipping_enabled) {
    return { error: de.fixtures.tippingDisabled };
  }

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
  if (error) {
    logActionError("submitPrediction", error);
    return { error: de.fixtures.saveError };
  }

  // The tip-pulse count ("5 von 8 haben getippt") just changed for the group.
  await invalidateTags(`tip-pulse:${parsed.data.tenantId}`);
  revalidatePath(`/${parsed.data.tenantId}/matches`);
  return { error: null, info: de.fixtures.saved };
}
