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
 */
export function createServiceClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
