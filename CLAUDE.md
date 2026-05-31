# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Private Tippspiel (football prediction game) for closed friend groups. v1 targets the **FIFA World
Cup 2026**. Members submit per-fixture score predictions before kickoff; results are synced (or
entered by an admin); points and a leaderboard follow. The data model is multi-event ready so other
tournaments can be added later without a rewrite.

## Hard conventions

- **Code, identifiers, comments, commit messages → English. User-facing UI text → German.** Never
  mix. Every German string lives in `src/messages/de.ts` (the single language boundary) — never
  inline German literals in components. A German identifier or an English UI label is a bug.
- **TypeScript strict** (`noUncheckedIndexedAccess` is on). Avoid `any` and compiler-silencing `!`.
- **Server-first.** Reads = Server Components via the cookie-aware client (RLS scopes rows
  automatically — never hand-write tenant filters as the security boundary). Mutations = Server
  Actions (`"use server"`) that Zod-validate input and re-resolve the user/tenant/role. The action
  is the trust boundary, not the form.
- **Authorization is enforced in Postgres via RLS** as the non-bypassable gate, in addition to
  server checks. A tenant table with RLS enabled but no policy is locked; without RLS it's wide open
  to the anon key. Treat a missing policy as a security bug.

## Stack

Next.js **16** (App Router, Turbopack) · React 19 · TypeScript strict · pnpm · Tailwind v4 +
shadcn/ui (Base UI preset; components are generated into `src/components/ui/`, edit them directly) ·
Supabase (Postgres + Auth, email+password) · Podman as the local/prod container runtime.

> **Next 16 gotchas (differ from Next 15 / training data):**
> - **Middleware is renamed to Proxy.** The session-refresh file is `src/proxy.ts` exporting
>   `proxy(request)`, not `middleware.ts`. Same `NextRequest`/`NextResponse` API; Node.js runtime.
> - Request APIs are async: `await cookies()`, and `params`/`searchParams` are Promises (`await params`).
> - `fetch` and Route Handlers are **not** cached by default.
> - The shadcn Button has **no `asChild`**; style links with `buttonVariants({...})` instead.
> - Read `node_modules/next/dist/docs/` before using unfamiliar framework features.

## Commands

```bash
pnpm dev            # dev server (localhost:3000)
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest (unit + integration; integration needs local Supabase up)
pnpm test <path>    # single file
pnpm format         # prettier --write .

pnpm sync                       # run the football-data.org sync once (needs FOOTBALL_DATA_API_TOKEN)
pnpm tsx scripts/generate-seed.ts   # regenerate supabase/seed.sql from data/openfootball/

# Supabase (CLI is a dev dependency → use `pnpm exec supabase`/the db:* scripts)
pnpm db:start       # supabase start
pnpm db:stop
pnpm db:reset       # rebuild local DB from migrations + seed.sql
pnpm db:types       # regenerate src/lib/supabase/database.types.ts (run after any schema change)
```

### Local Supabase on Podman

The Supabase CLI talks to the Docker API. `podman machine start` forwards a compatible socket at
`/var/run/docker.sock`, so point the CLI at it:

```bash
export DOCKER_HOST="unix:///var/run/docker.sock"
pnpm exec supabase start
pnpm exec supabase status -o env   # API URL + ANON_KEY + SERVICE_ROLE_KEY for .env.local
```

Troubleshooting: if container create fails with `readlink .../overlay/l: invalid argument`, the
machine's **rootful** storage is corrupted — switch to rootless (`podman machine set --rootful=false`
then restart). After regenerating `database.types.ts`, run `pnpm typecheck`.

## Architecture

**Auth is defense-in-depth across three layers:** (1) `src/proxy.ts` only refreshes the session
cookie; (2) every protected page/layout + Server Action calls `supabase.auth.getClaims()` (never
`getSession()` server-side) and re-resolves membership/role; (3) Postgres RLS is the final gate.
Tenancy is path-scoped (`/(app)/[tenantSlug]/…`); `src/lib/auth/membership.ts` resolves
`{tenantId, role, userId, supabase}` once per request.

**Supabase clients** (`src/lib/supabase/`, keep separate): `client.ts` (browser), `server.ts`
(cookie-aware, for Server Components/Actions), `session.ts` (used by proxy), and `service.ts`
(service-role, **bypasses RLS** — only for the sync job and admin result overrides, never per-user
reads, never the browser).

**Data model** — "tenant" is the internal name for a player group (rendered as "Gruppe" in the UI;
`group` is a reserved SQL word). Event spine: `sport → competition → season → stage → fixture`
(+ `team`), all carrying `(provider, external_id) UNIQUE` for idempotent, provider-swappable syncs.
Tenancy: `tenant`, `tenant_member` (per-tenant `role` admin|member), `tenant_season`,
`tenant_invite`. Plus `prediction`, `scoring_rule_set` (versioned JSONB config), `prediction_score`,
the `leaderboard` view (`security_invoker`), and `admin_audit_log`.

**RLS & DB invariants** (the footgun-heavy core, in `supabase/migrations/`):
- Authorization helpers `private.is_member/is_admin/shares_tenant/fixture_in_tenant` live in a
  non-exposed `private` schema and are **`SECURITY DEFINER` + `LANGUAGE plpgsql`** (a `LANGUAGE sql`
  helper gets inlined → reintroduces RLS recursion). Policies wrap calls in `(select …)` for
  per-statement caching and use `to authenticated`.
- The **prediction deadline** is a `BEFORE INSERT/UPDATE` trigger comparing `now()` to the fixture's
  kickoff (DB clock, not the UI). Pre-kickoff secrecy is also a SELECT policy (others see a
  prediction only once `kickoff_at <= now()`; owner/admin always).
- Every tenant must keep ≥1 admin (trigger) — but the trigger skips when the tenant itself is being
  deleted (so cascade deletes work).
- Tenant creation and invite redemption run via `SECURITY DEFINER` RPCs (`create_group`,
  `redeem_invite`) to solve the membership chicken-and-egg.

**Scoring** is server-authoritative and stored. The SQL function `score_prediction(...)` is the
single source of truth; `score_fixture(fixture_id)` (service_role only) recomputes a fixture's
scores in one transaction; `recompute_tenant(...)` re-scores after a rule change. `src/lib/scoring/
engine.ts` is a pure TS **mirror** for unit tests + the in-form preview — never authoritative.
Knockout matches are scored on the **90-minute** result; `advancing_team` predictions get a bonus.

**Sync** (`src/lib/providers/footballData.ts` adapter → `src/lib/sync/run.ts`): idempotent upserts
by `(provider, external_id)`, then `score_fixture` for finished matches. Triggered by an OS/container
timer hitting the secret-protected `POST /api/cron/sync` (Bearer `CRON_SECRET`) or `pnpm sync`. Never
call the provider from request handlers. Local dev/tests use the **openfootball seed**
(`provider = "openfootball"`); production uses the live sync (`provider = "football-data"`).

## Source layout

```
src/proxy.ts                       # Next 16 proxy: session refresh + auth redirect
src/app/(public)/{login,register}  # auth pages; (public) layout redirects logged-in users home
src/app/(app)/page.tsx             # tenant chooser (create / join)
src/app/(app)/[tenantSlug]/…       # dashboard, spiele (tipping), spiel/[id], rangliste, profil, admin
src/app/api/cron/sync/route.ts     # secret-protected sync trigger
src/app/datenschutz/page.tsx       # DSGVO notice (placeholder — complete before launch)
src/actions/                       # "use server" mutations (auth, tenant, predictions, profile, admin)
src/components/{ui,...}            # shadcn primitives + feature components
src/lib/{supabase,auth,data,providers,sync,scoring,domain,i18n}/
src/messages/de.ts                 # all German UI strings
supabase/migrations/               # schema + RLS + triggers + functions (source of truth)
supabase/seed.sql                  # GENERATED — edit scripts/generate-seed.ts, not this file
data/openfootball/                 # vendored public-domain WM2026 schedule (seed source)
tests/                             # vitest integration (RLS/deadline/scoring); *.test.ts is unit
```

## Environment

`.env.local` (git-ignored, from `supabase status -o env`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — never `NEXT_PUBLIC_`),
`FOOTBALL_DATA_API_TOKEN` (free key from football-data.org), `FOOTBALL_DATA_COMPETITION` (default
`WC`), `CRON_SECRET`. `.env.example` documents the keys. Env is Zod-validated: public in
`src/lib/env.ts`, server-only in `src/lib/env.server.ts` (guarded by `server-only`).

## Testing

Integration tests in `tests/` create real auth users and assert RLS isolation (group A cannot read
B), pre-kickoff secrecy, the deadline trigger, scoring, leaderboard ranking, and SQL↔TS scoring
parity. They need the local Supabase stack running and skip themselves if its keys are absent.
