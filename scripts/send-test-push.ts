/**
 * Send a test Web Push to stored subscriptions — verifies the VAPID setup and
 * the service worker end-to-end (without waiting for a real fixture). Runs with
 * the service role; reads push_subscription directly and prunes dead endpoints.
 *
 * Run:
 *   pnpm tsx scripts/send-test-push.ts                 # all subscriptions
 *   pnpm tsx scripts/send-test-push.ts <email>         # only this user's devices
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import webpush from "web-push";

import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // Mirrors webPushSender(): the contact address defaults to the operator mail.
  const subject =
    process.env.VAPID_SUBJECT ||
    (process.env.OPERATOR_EMAIL ? `mailto:${process.env.OPERATOR_EMAIL}` : "");
  if (!publicKey || !privateKey) {
    console.error("VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
    process.exit(1);
  }
  if (!subject) {
    console.error("VAPID contact missing — set VAPID_SUBJECT or OPERATOR_EMAIL.");
    process.exit(1);
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }
  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = process.argv[2];
  let userIds: string[] | null = null;
  if (email) {
    const { data } = await supabase.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === email);
    if (!user) {
      console.error(`No user with email ${email}.`);
      process.exit(1);
    }
    userIds = [user.id];
  }

  let query = supabase.from("push_subscription").select("endpoint, p256dh, auth, user_id");
  if (userIds) query = query.in("user_id", userIds);
  const { data: subs, error } = await query;
  if (error) throw error;
  if (!subs || subs.length === 0) {
    console.log("No subscriptions found.");
    return;
  }

  const payload = JSON.stringify({
    title: "TippKeks Test 🔔",
    body: "Test-Benachrichtigung – wenn du das siehst, funktioniert Push!",
    url: "/",
    tag: "test-push",
  });

  let ok = 0;
  let gone = 0;
  let failed = 0;
  for (const s of subs) {
    const label = s.endpoint.slice(0, 55);
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      ok += 1;
      console.log(`✓ sent   ${label}…`);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        gone += 1;
        await supabase.from("push_subscription").delete().eq("endpoint", s.endpoint);
        console.log(`✗ gone   ${label}… (pruned)`);
      } else {
        failed += 1;
        console.error(`✗ fail   ${label}… (status ${status ?? "?"})`);
      }
    }
  }
  console.log(`\nDone: ${ok} sent, ${gone} pruned, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
