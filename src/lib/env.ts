import { z } from "zod";

/**
 * Public, client-safe environment. Referencing `process.env.NEXT_PUBLIC_*` as
 * string literals lets Next inline the values into the browser bundle at build
 * time. Validated once at module load so a misconfigured deployment fails fast.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const publicEnv = PublicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
