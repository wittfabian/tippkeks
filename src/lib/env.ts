import { z } from "zod";

/**
 * Public, client-safe environment. Referencing `process.env.NEXT_PUBLIC_*` as
 * string literals lets Next inline the values into the browser bundle at build
 * time. Validated once at module load so a misconfigured deployment fails fast.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // VAPID public key for Web Push. Optional: when absent the push toggle hides
  // itself and the app runs without notifications. Inlined into the browser
  // bundle so the client can subscribe; the matching private key is server-only.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z
    .string()
    .min(1)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export const publicEnv = PublicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});
