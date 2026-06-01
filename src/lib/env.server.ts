import "server-only";
import { z } from "zod";

/**
 * Server-only environment. The `server-only` import makes importing this from a
 * Client Component a build error, so the service-role key can never leak into
 * the browser bundle. Every var here is optional and asserted at its point of
 * use, so the app (and `next build`) boots without any of them configured —
 * notably the build never needs the service-role key (it only validates env and
 * never contacts Supabase), so CI must NOT be given that secret. Runtime
 * consumers assert their own needs: `createServiceClient()` for the key, the
 * cron route for CRON_SECRET, the provider for FOOTBALL_DATA_API_TOKEN.
 */
// Treat empty strings (common in .env files) as absent so optional/default apply.
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FOOTBALL_DATA_API_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FOOTBALL_DATA_COMPETITION: z.preprocess(emptyToUndefined, z.string().min(1).default("WC")),
  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  // Valkey/Redis connection for the data cache and rate limiting. Optional: when
  // absent the cache no-ops (reads fall through to Postgres) and rate limits
  // fail open, so the app boots fine without it.
  REDIS_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

export const serverEnv = ServerEnvSchema.parse(process.env);
