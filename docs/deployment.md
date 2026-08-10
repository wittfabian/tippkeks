# Deployment

How a TippKeks instance is built and run. Two workflows live in
[`.github/workflows/`](../.github/workflows/); nothing is hardcoded in the YAML,
so configure the repository first.

## GitHub repository configuration (one-time)

Settings → _Secrets and variables_ → _Actions_.

**Variables** tab — not confidential (the anon key is inlined into the client
bundle and already ships to browsers), so they live as Variables, not Secrets:

| Name                            | Used by            | Value                                                       |
| ------------------------------- | ------------------ | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | CI build + Release | Production Supabase project URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CI build + Release | Production anon (publishable) key                           |
| `PAGE_URL`                      | Project page       | Canonical URL of the GitHub Pages site, with trailing slash |

**Secrets** tab:

| Name                                                          | Used by                  | Value                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`                          | Release build (embedded) | `openssl rand -base64 32`. `next build` embeds it into the image (and compiles it into any Edge bundle, where runtime can't override it). Keep it **stable across releases** and inject the **same** value at runtime. |
| `OPERATOR_NAME` / `_STREET` / `_CITY` / `_COUNTRY` / `_EMAIL` | Project page             | Renders the § 5 DDG block in the published page's footer. All five or none.                                                                                                                                            |

> `SUPABASE_SERVICE_ROLE_KEY` is **not** a CI secret: it is only needed at runtime
> (asserted in `createServiceClient`), so the build never sees it. Keeping it out
> of CI removes any chance of the production service-role key leaking into a build
> log or artifact. Inject it only into the running container/deployment.

> The repo's built-in `GITHUB_TOKEN` is used to push images to GHCR — no PAT needed.
> Just allow Actions to write packages: Settings → Actions → General → Workflow
> permissions.

## 1. CI — `ci.yml` (runs on every push to `main` and every PR)

Steps: install → `typecheck` → `lint` → `format:check` → `test` → `build`.

- The **build** step pulls only `NEXT_PUBLIC_*` from the repo Variables (they are
  inlined into the client bundle, so they must be present). It needs no Supabase
  secret — `next build` validates env but never reaches Supabase, and the
  service-role key is asserted lazily at runtime.
- The **integration tests** (`tests/*.integration.test.ts`) self-skip when the
  Supabase keys are absent (`tests/helpers.ts` → `hasSupabase === false →
describe.skip`), so CI runs the unit tests only and needs no live database.

Recommended: a **branch protection rule** on `main` requiring the `verify` check
to pass before merge (Settings → Branches).

### Running the integration tests in CI (optional)

They are skipped by default. To run them, start a Supabase stack inside the
workflow and export `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` (the local stack's keys) before `pnpm test` —
e.g. via `supabase start` or a Postgres service container with the migrations
applied.

## 2. Release image — `release.yml` (manual, builds & pushes to GHCR)

Triggered from the **Actions** tab → _Release image_ → enter a tag (e.g. `v1.0.0`
or `latest`). It builds the production image with the two `NEXT_PUBLIC_*`
Variables as build args and the `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` Secret as a
**BuildKit secret** (mounted during `next build`, never persisted in image
layers/history), and pushes it to `ghcr.io/<owner>/<repo>`. The encryption key is
embedded into the build, so it must be set as a Secret (not provided only at
runtime).

## 3. Project page — `pages.yml`

Generates the public project page from `src/messages/de.ts` via
`scripts/generate-landing.ts` and deploys it to GitHub Pages. Set Settings →
Pages → Source to **GitHub Actions** once. The generated `site/` directory is
git-ignored — it is built in the workflow, partly from Secrets.

## Runtime configuration (NOT in GitHub)

The release workflow only **builds and pushes** the image; it does not deploy.
Server-only secrets are injected where the container actually runs (your host or
orchestrator), never baked into the image and never stored in GitHub Actions.
When you `docker run` / deploy, provide:

| Variable                                                      | Purpose                                                                                                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                                   | Server-only; sync job + admin overrides + managed members (bypasses RLS). A Secret key (`sb_secret_…`, Dashboard → Settings → API Keys), or the legacy `service_role` key (valid until end of 2026). |
| `OPERATOR_NAME` / `_STREET` / `_CITY` / `_COUNTRY` / `_EMAIL` | Who runs this instance. Rendered on `/imprint` and `/privacy` — a public deployment legally needs all five. Read per request, so the image itself stays free of personal data.                       |
| `CRON_SECRET`                                                 | Bearer token guarding `POST /api/cron/sync`. `openssl rand -hex 32`.                                                                                                                                 |
| `FOOTBALL_DATA_API_TOKEN`                                     | football-data.org API token for the live result sync.                                                                                                                                                |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`                          | **Same value as the build Secret above** — embedded at build, the Node server re-reads it at runtime and it must match across all replicas.                                                          |
| `SITE_URL`                                                    | Canonical public origin, e.g. `https://example.org`. Without it, auth redirect links point at the internal container address.                                                                        |
| `FOOTBALL_DATA_COMPETITION`                                   | Optional; competition code (default `WC`).                                                                                                                                                           |
| `REDIS_URL` / `REDIS_PASSWORD`                                | Optional; Valkey/Redis for the cache + rate limiting.                                                                                                                                                |
| `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`                         | Optional; Web Push. Without them the dispatcher no-ops.                                                                                                                                              |

See [`.env.example`](../.env.example) for the full annotated list,
[`docker-compose.prod.yml`](../docker-compose.prod.yml) for a working
composition, and [`sync-scheduler.md`](./sync-scheduler.md) for the cron setup.

## Legal pages

`/imprint` and `/privacy` describe **the reference deployment**: hosting at
Hetzner, Supabase in Frankfurt, Resend for mail, football-data.org for fixtures,
and the Bavarian supervisory authority. The operator identity is configuration,
but the rest of that text is not — if you run your own instance, read
`de.legal.privacy` and `de.legal.impressum` in `src/messages/de.ts` and rewrite
whatever does not match your setup. That is your legal responsibility, and no
environment variable can do it for you.
