import "server-only";
import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client that BYPASSES RLS. Use only for deliberate server-side
 * privileged work: the fixture/result sync and admin result overrides. Never
 * import this into anything that reaches the browser, and never use it to serve
 * per-user reads (that is what the cookie-aware server client + RLS are for).
 *
 * The key is asserted here (not at env-parse time) so the build never requires
 * it — it is only ever needed at runtime when this client is actually created.
 */
export function createServiceClient() {
  const serviceRoleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required at runtime for the " +
        "service-role client (fixture sync, admin result overrides, managed members).",
    );
  }
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
