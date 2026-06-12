"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Persist a browser Web Push subscription for the current user. Called from the
 * client after the user grants permission (not a form post — the PushSubscription
 * is a JSON object). RLS scopes the row to the caller; the endpoint is the
 * conflict key so re-subscribing the same device updates in place.
 */
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional(),
});

export async function savePushSubscriptionAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false };

  const { error } = await supabase.from("push_subscription").upsert(
    {
      user_id: userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

/** Remove one of the caller's push subscriptions (RLS ensures own-rows only). */
export async function deletePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  const parsed = z.string().url().safeParse(endpoint);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false };

  const { error } = await supabase.from("push_subscription").delete().eq("endpoint", parsed.data);
  return { ok: !error };
}
