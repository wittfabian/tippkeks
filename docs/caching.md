# Caching & rate limiting (Valkey)

A Valkey (Redis-compatible) store backs two things: an application-level **data
cache** for global/tenant-uniform reads, and **rate limiting** for abuse-prone
auth endpoints. Both are **optional** — with `REDIS_URL` unset the cache no-ops
(reads fall through to Postgres) and rate limits fail open, so the app runs
identically without Valkey.

## The golden rule

**Never cache an RLS-scoped / per-user read.** The cache is keyed only by its
`key` string, so two users would share one entry and leak across the tenant
boundary — which would silently defeat the RLS defense-in-depth. Only cache data
that is **identical for everyone who may see it**:

- ✅ Global: tournament schedule (`fixture`), `team`, `app_setting`.
- ✅ Tenant-uniform: a tenant's `leaderboard` (same rows for every member).
- ⛔ Per-user: predictions/scores, memberships — read live via the caller's
  RLS-scoped client. Predictions additionally carry pre-kickoff secrecy.

Cached global/tenant reads use the **service role** (`createServiceClient`)
inside the cache fetcher, because the data is non-sensitive and not user-scoped.

## What is cached

| Data             | Where                     | Key                      | TTL  | Tags                                    |
| ---------------- | ------------------------- | ------------------------ | ---- | --------------------------------------- |
| Fixtures + teams | `lib/data/fixtures.ts`    | `tournament:<seasonIds>` | 60s  | `tournament`                            |
| App settings     | `lib/data/settings.ts`    | `app-settings`           | 300s | `app-settings`                          |
| Leaderboard      | `lib/data/leaderboard.ts` | `leaderboard:<tenantId>` | 60s  | `leaderboard`, `leaderboard:<tenantId>` |

TTL is a backstop; correctness comes from **tag invalidation**:

| Trigger                                     | Invalidates                 |
| ------------------------------------------- | --------------------------- |
| Sync job (`lib/sync/run.ts`)                | `tournament`, `leaderboard` |
| Admin result override (`actions/admin.ts`)  | `tournament`, `leaderboard` |
| Scoring-rule recompute (`actions/admin.ts`) | `leaderboard:<tenantId>`    |
| Settings save (`actions/settings.ts`)       | `app-settings`              |

### Why application-level, not Next's `revalidateTag`

The sync runs both inside the Next runtime (`POST /api/cron/sync`) **and** as a
standalone CLI (`pnpm sync`). `revalidateTag` only affects the runtime it's
called in, so it can't invalidate from the CLI process (or reach a second app
instance). Invalidating through the shared Valkey store crosses process and
instance boundaries. `invalidateTags()` (`lib/cache/cache.ts`) maintains a Redis
set per tag and drops all member keys at once.

## Rate limiting

Fixed-window limiter (`lib/cache/rate-limit.ts`), keyed by purpose + subject.
Fails **open** when Valkey is down (availability first; Supabase Auth also limits
server-side as a second layer).

| Endpoint                     | Limit                                          |
| ---------------------------- | ---------------------------------------------- |
| `signInAction`               | 20 / 5 min per IP                              |
| `requestPasswordResetAction` | 5 / 15 min per IP **and** 3 / 60 min per email |

On a password-reset limit hit we silently skip the send but still return the
generic "if an account exists…" message, so the limiter can't be used to probe
which emails exist.

## Local setup

```bash
podman compose up -d        # or: docker compose up -d   (docker-compose.yml)
```

Then add to `.env.local`:

```
REDIS_URL="redis://127.0.0.1:6379"
```

Pure cache: persistence is disabled (`--save "" --appendonly no`) since the data
is rebuildable from Postgres. Inspect with `podman exec -it tippkeks-valkey valkey-cli`.

> **Troubleshooting:** if `podman compose` errors with `docker-credential-desktop
... not found`, it delegated to Docker's compose provider, whose credential
> helper is misconfigured. Either use `podman-compose up -d` (the Python
> provider), or `podman pull docker.io/valkey/valkey:8-alpine` once and re-run,
> or remove `"credsStore": "desktop"` from `~/.docker/config.json`. The image
> itself runs fine under podman.

## Production

`docker-compose.prod.yml` runs the app + Valkey on a private bridge network.
Valkey publishes **no ports** (reachable only as `redis://valkey:6379` from the
app); the app publishes on `127.0.0.1:3000` for a host reverse proxy to
TLS-terminate and upstream to.

```bash
podman compose --env-file .env.prod -f docker-compose.prod.yml pull
podman compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

The compose file runs the **pre-built** image from GHCR (published by CI,
`release.yml`) — it does not build. The app's `env_file` injects the runtime
secrets; `NEXT_PUBLIC_*` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` are already baked
into the image at CI build time. You set only `REDIS_PASSWORD` in `.env.prod` (not
`REDIS_URL`); the app
assembles `redis://:<password>@valkey:6379` at startup (see `src/lib/env.server.ts`),
so the connection always points at the private service. An explicit `REDIS_URL`,
if set, takes precedence (that is the local-dev path against `127.0.0.1:6379`).

**Sync invalidation:** trigger the sync via the in-container route
(`POST /api/cron/sync`) — it shares the network and can reach Valkey to
`invalidateTags`. A host-side `pnpm sync` could **not** reach Valkey (no
published port), so cache invalidation would rely on TTL only; prefer the route
in production.

**Multiple replicas:** set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
(`openssl rand -base64 32`) across all app replicas, and point them at the same
Valkey — then the cache and its tag invalidation stay consistent across them.

## Scaling note

Single app instance: Valkey is optional (the built-in per-process behaviour is
fine; Valkey mainly makes the cache survive restarts and enables CLI-triggered
invalidation). It becomes **necessary** once you run more than one app instance,
so the cache and its invalidation stay consistent across them.
