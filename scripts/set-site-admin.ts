/**
 * Grant (or revoke) site-admin rights to a user by email. Site admins control
 * the global toggles (registration, group creation) on /einstellungen. This is
 * deliberately the ONLY way to become a site admin — there is no self-service
 * path — so it runs server-side with the service-role key.
 *
 * Run:
 *   pnpm tsx scripts/set-site-admin.ts <email>            # grant
 *   pnpm tsx scripts/set-site-admin.ts <email> --revoke   # revoke
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");
  if (!email) {
    console.error("Usage: pnpm tsx scripts/set-site-admin.ts <email> [--revoke]");
    process.exitCode = 1;
    return;
  }

  // Build the service-role client directly (avoids the `server-only` guard that
  // src/lib/supabase/service.ts carries, which throws outside the Next runtime).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exitCode = 1;
    return;
  }
  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the auth user by email (paginate the admin list defensively).
  let userId: string | undefined;
  for (let page = 1; page <= 100 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 1000) break;
  }
  if (!userId) {
    console.error(`No user found with email ${email}. They must register first.`);
    process.exitCode = 1;
    return;
  }

  if (revoke) {
    const { error } = await supabase.from("site_admin").delete().eq("user_id", userId);
    if (error) throw error;
    console.log(`[site-admin] revoked from ${email}`);
    return;
  }

  const { error } = await supabase.from("site_admin").upsert({ user_id: userId });
  if (error) throw error;
  console.log(`[site-admin] granted to ${email}`);
}

main().catch((error) => {
  console.error("[site-admin] failed:", error);
  process.exitCode = 1;
});
