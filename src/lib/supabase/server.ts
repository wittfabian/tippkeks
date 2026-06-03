import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cookie-aware Supabase client for Server Components, Server Actions and Route
 * Handlers. RLS scopes every query to the caller automatically. Writes from a
 * Server Component throw (cookies are read-only there); that is expected and
 * harmless because the proxy refreshes the session on the next request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — ignore; the proxy handles refresh.
          }
        },
      },
    },
  );
}

/** The cookie-aware (RLS-scoped) client returned by `createClient`. */
export type ServerClient = Awaited<ReturnType<typeof createClient>>;
