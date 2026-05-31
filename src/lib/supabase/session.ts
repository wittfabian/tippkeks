import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the Supabase auth session on each request and reports the validated
 * claims. Called from proxy.ts. Follows the Supabase SSR contract: no logic
 * between client creation and the auth call, and the returned response (which
 * carries refreshed Set-Cookie headers) must be propagated.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() validates the JWT signature and triggers a token refresh when
  // the access token is near expiry (writing fresh cookies via setAll above).
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
