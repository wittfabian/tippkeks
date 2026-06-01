# Tippkeks

Private Tippspiel (football prediction game) for closed friend groups. v1 targets the **FIFA World
Cup 2026**: members submit per-fixture score predictions before kickoff, results are synced, and a
leaderboard follows. Architecture and conventions live in [`CLAUDE.md`](./CLAUDE.md); operational
notes are under [`docs/`](./docs).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · pnpm · Tailwind v4 + shadcn/ui ·
Supabase (Postgres + Auth) · Podman as the container runtime.

## Local development

Prerequisites: Node ≥ 22, pnpm (`corepack enable`), Podman (runs the local Supabase + Valkey).

```bash
pnpm install
export DOCKER_HOST="unix:///var/run/docker.sock"   # let the Supabase CLI reach Podman
pnpm db:start                                       # local Postgres + Auth
pnpm exec supabase status -o env                    # copy URL + keys into .env.local
cp .env.example .env.local                          # then fill in the values above
pnpm dev                                            # http://localhost:3000
```

Common scripts: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`,
`pnpm db:reset`, `pnpm db:types`. See `CLAUDE.md` for the full list.

## Continuous integration & GitHub setup

Two workflows live in [`.github/workflows/`](./.github/workflows). Nothing is hardcoded in the YAML:
both read their Supabase config from GitHub repository **Variables/Secrets**, so configure these
once before the workflows can pass.

### GitHub repository configuration (one-time)

Settings → _Secrets and variables_ → _Actions_.

**Variables** tab — not confidential (the anon key is inlined into the client bundle and already
ships to browsers), so they live as Variables, not Secrets:

| Name                            | Used by            | Value                             |
| ------------------------------- | ------------------ | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | CI build + Release | Production Supabase project URL   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CI build + Release | Production anon (publishable) key |

**Secrets** tab:

| Name                                 | Used by                  | Value                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Release build (embedded) | `openssl rand -base64 32`. `next build` embeds it into the image (and compiles it into any Edge bundle, where runtime can't override it). Keep it **stable across releases** and inject the **same** value at runtime. |

> `SUPABASE_SERVICE_ROLE_KEY` is **not** a CI secret: it is only needed at runtime
> (asserted in `createServiceClient`), so the build never sees it. Keeping it out
> of CI removes any chance of the production service-role key leaking into a build
> log or artifact. Inject it only into the running container/deployment.

> The repo's built-in `GITHUB_TOKEN` is used to push images to GHCR — no PAT needed. Just allow
> Actions to write packages: Settings → Actions → General → Workflow permissions.

### 1. CI — `ci.yml` (runs on every push to `main` and every PR)

Steps: install → `typecheck` → `lint` → `format:check` → `test` → `build`.

- The **build** step pulls only `NEXT_PUBLIC_*` from the repo Variables (they are inlined into the
  client bundle, so they must be present). It needs no Supabase secret — `next build` validates env
  but never reaches Supabase, and the service-role key is asserted lazily at runtime.
- The **integration tests** (`tests/*.integration.test.ts`) self-skip when the Supabase keys are
  absent (`tests/helpers.ts` → `hasSupabase === false → describe.skip`), so CI runs the unit tests
  only and needs no live database.

Recommended (optional): a **branch protection rule** on `main` requiring the `verify` check to pass
before merge (Settings → Branches).

#### Running the integration tests in CI (optional)

They are skipped by default. To run them, start a Supabase stack inside the workflow and export
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (the
local stack's keys) before `pnpm test` — e.g. via `supabase start` or a Postgres service container
with the migrations applied.

### 2. Release image — `release.yml` (manual, builds & pushes a Docker image to GHCR)

Triggered from the **Actions** tab → _Release image_ → enter a tag (e.g. `v1.0.0` or `latest`). It
builds the production image with the two `NEXT_PUBLIC_*` Variables and the
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` Secret above as build args, and pushes it to
`ghcr.io/<owner>/<repo>`. The encryption key is embedded into the build, so it must be set as a
Secret (not provided only at runtime) — see the table above.

### Runtime secrets (NOT configured in GitHub)

The release workflow only **builds and pushes** the image; it does not deploy. Server-only secrets
are injected where the container actually runs (your host / orchestrator), never baked into the
image and never stored in GitHub Actions. When you `docker run` / deploy, provide:

| Variable                             | Purpose                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`          | Server-only; sync job + admin result overrides (bypasses RLS).                                                                              |
| `CRON_SECRET`                        | Bearer token guarding `POST /api/cron/sync`. `openssl rand -hex 32`.                                                                        |
| `FOOTBALL_DATA_API_TOKEN`            | football-data.org API token for the live result sync.                                                                                       |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | **Same value as the build Secret above** — embedded at build, the Node server re-reads it at runtime and it must match across all replicas. |
| `FOOTBALL_DATA_COMPETITION`          | Optional; competition code (default `WC`).                                                                                                  |
| `REDIS_URL`                          | Optional; Valkey/Redis for the cache + rate limiting.                                                                                       |

See `.env.example` for the full annotated list and `docs/sync-scheduler.md` for the cron setup.
