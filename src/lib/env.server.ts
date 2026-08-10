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
  // Canonical public origin (e.g. https://tippkeks.de). Used to build absolute
  // auth redirect URLs, since `request.url` behind the reverse proxy reflects the
  // internal bind address (0.0.0.0:3000), not the public host.
  SITE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  // Contact address of whoever runs this instance: shown on the info page and
  // used as the Web Push contact. Runtime env and NOT NEXT_PUBLIC_*, so the
  // published container image carries no operator's address.
  OPERATOR_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  // Directory holding the operator's own Impressum and Datenschutzerklärung as
  // `imprint.html` / `privacy.html`. The app ships neither: legal texts describe
  // a specific deployment (its host, its mail provider, its supervisory
  // authority), so shipping any would hand every self-hoster a document that is
  // wrong for them. Absent → the pages say the document is not configured.
  LEGAL_DIR: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  // Valkey/Redis connection for the data cache and rate limiting. Optional: when
  // absent the cache no-ops (reads fall through to Postgres) and rate limits
  // fail open, so the app boots fine without it.
  REDIS_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  // Production (docker-compose.prod.yml): only the Valkey password is supplied as
  // a runtime env var; the URL is assembled below against the compose service
  // host. An explicit REDIS_URL (local dev) always wins.
  REDIS_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  // Web Push (VAPID). The private key signs push messages; pairs with the public
  // NEXT_PUBLIC_VAPID_PUBLIC_KEY. Optional: without it the dispatcher no-ops, so
  // the app and the cron run fine without push configured. VAPID_SUBJECT is the
  // contact URL/mailto the push services require; derived from OPERATOR_EMAIL
  // below when not set explicitly.
  VAPID_PRIVATE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  VAPID_SUBJECT: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

const parsed = ServerEnvSchema.parse(process.env);

// Prod Valkey runs with `--requirepass`, reachable only as `valkey:6379` on the
// private compose network. When no explicit REDIS_URL is set but a password is,
// build the authenticated URL the password implies (hex secrets are URL-safe;
// encode defensively anyway). Without this the app would have the password but
// no URL, so getRedis() returns null — silently disabling cache + rate limiting.
const redisUrl =
  parsed.REDIS_URL ??
  (parsed.REDIS_PASSWORD
    ? `redis://:${encodeURIComponent(parsed.REDIS_PASSWORD)}@valkey:6379`
    : undefined);

// Push services require a contact address in every signed request. The operator
// mail is exactly that contact, so default to it rather than carrying a second
// copy of the same address in the deployment config.
const vapidSubject =
  parsed.VAPID_SUBJECT ?? (parsed.OPERATOR_EMAIL ? `mailto:${parsed.OPERATOR_EMAIL}` : undefined);

export const serverEnv = { ...parsed, REDIS_URL: redisUrl, VAPID_SUBJECT: vapidSubject };
