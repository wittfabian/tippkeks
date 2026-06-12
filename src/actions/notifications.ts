"use server";

import { z } from "zod";

import {
  isAllowedPushEndpoint,
  webPushSender,
  type NotificationPayload,
} from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";
import { de } from "@/messages/de";

/** Cap on distinct devices per user, so subscriptions can't be inserted unbounded. */
const MAX_SUBSCRIPTIONS_PER_USER = 20;

/**
 * Persist a browser Web Push subscription for the current user. Called from the
 * client after the user grants permission (not a form post — the PushSubscription
 * is a JSON object). RLS scopes the row to the caller; the endpoint is the
 * conflict key so re-subscribing the same device updates in place. The endpoint
 * is allowlisted to real push services (the server later POSTs to it — see
 * isAllowedPushEndpoint).
 */
const subscriptionSchema = z.object({
  endpoint: z.string().url().refine(isAllowedPushEndpoint),
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

  // Reject a NEW device once the per-user cap is reached (re-subscribing an
  // existing endpoint still updates in place via the upsert below).
  const { data: existing } = await supabase
    .from("push_subscription")
    .select("endpoint")
    .eq("user_id", userId);
  const known = new Set((existing ?? []).map((s) => s.endpoint));
  if (!known.has(parsed.data.endpoint) && known.size >= MAX_SUBSCRIPTIONS_PER_USER) {
    return { ok: false };
  }

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

/**
 * Send a sample notification to the caller's own devices so they can see what a
 * push looks like right after enabling. Reads their subscriptions through the
 * RLS-scoped client (own rows only — no service role) and reuses the dispatcher's
 * VAPID sender; dead endpoints are pruned. Returns how many devices accepted it.
 */
export async function sendTestPushAction(): Promise<{ ok: boolean; sent: number }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, sent: 0 };

  const sender = webPushSender();
  if (!sender) return { ok: false, sent: 0 };

  const { data: subs } = await supabase
    .from("push_subscription")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return { ok: false, sent: 0 };

  const payload: NotificationPayload = {
    title: de.notifications.testTitle,
    body: de.notifications.testBody,
    url: "/",
    tag: "test-push",
  };

  let sent = 0;
  for (const sub of subs) {
    const result = await sender(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      payload,
    );
    if (result === "ok") sent += 1;
    else if (result === "gone") {
      await supabase.from("push_subscription").delete().eq("endpoint", sub.endpoint);
    }
  }
  return { ok: sent > 0, sent };
}
