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
>
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
pnpm tsx scripts/generate-pwa-assets.ts  # regenerate PWA icons (from src/app/icon.svg) + public/offline.html (from de.ts)
pnpm tsx scripts/set-site-admin.ts <email> [--revoke]  # grant/revoke site-admin (service role)
pnpm tsx scripts/seed-mock.ts [group-id]   # DEV-ONLY: mock players + tips + finished results → leaderboard (defaults to newest group)
pnpm tsx scripts/generate-vapid-keys.ts    # generate a Web Push VAPID key pair (once per deploy)
pnpm tsx scripts/generate-landing.ts       # regenerate site/ (GitHub Pages project page + SEO assets, from de.ts)

# Supabase (CLI is a dev dependency → use `pnpm exec supabase`/the db:* scripts)
pnpm db:start       # supabase start
pnpm db:stop
pnpm db:reset       # rebuild local DB from migrations + seed.sql
pnpm db:types       # regenerate src/lib/supabase/database.types.ts (run after any schema change)

podman compose up -d   # local Valkey for the cache + rate limiting (docker-compose.yml); then set REDIS_URL
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
Tenancy is path-scoped (`/(app)/[tenantId]/…`, the tenant's uuid — groups have no slug);
`src/lib/auth/membership.ts` resolves
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
- **Site admins** (operators of the whole install, distinct from per-tenant admins) live in the
  `site_admin` table, checked via `private.is_site_admin()`. Granted only out-of-band by
  `scripts/set-site-admin.ts` (no self-service path). Global feature toggles live in `app_setting`
  (`registration_enabled`, `group_creation_enabled`); the two public keys are readable by anon (the
  register page needs them pre-session), other keys are authenticated-only, and writes are
  site-admin only. Site settings UI: `/(app)/settings`.
  - `group_creation_enabled` is a **hard gate**: `create_group` (the only way to insert a tenant —
    no INSERT policy exists on `tenant`) re-checks it under definer rights.
  - `registration_enabled` is **best-effort only**: it is enforced in the register page + the
    `signUpAction`, but a client could call `supabase.auth.signUp` directly with the anon key
    (GoTrue does not consult `app_setting`). For a hard gate, disable signups at the Supabase
    project level or add a GoTrue _before-user-created_ Auth Hook. Do NOT add a blunt `auth.users`
    INSERT trigger — it would also block admin/service-role user provisioning (seed + set-site-admin).
- **Per-tenant `member_tipping_enabled`** (on `tenant`): when false, members are view-only — the
  `prediction` INSERT/UPDATE policies block their own writes while still letting an admin write for
  any member (`private.is_member_of` + `is_admin`). There is intentionally **no `prediction` DELETE
  policy** (nobody retracts tips via the app; deletes are service-role only).
- **MFA step-up is a DB gate, not just app-layer.** `private.mfa_satisfied()` (definer) is false when
  the caller has a verified `auth.mfa_factors` row but the JWT `aal` is not `aal2`. RESTRICTIVE
  `to authenticated` policies on the personal/tenant tables AND it onto the permissive policies (so an
  aal1-with-factor session is denied every direct read/write), and the user-mutation definer RPCs
  (`create_group`, `redeem_invite`, `delete_own_account`, `recompute_tenant`) re-check it since they
  bypass RLS. The `(app)` layout redirect to `/mfa` is the UX path; this is the non-bypassable one.
  No-factor users are unaffected; the service role bypasses it.
- **Account deletion** is the `delete_own_account()` definer RPC: in one transaction it blocks a sole
  admin of a group that still has other members (raises `SOLE_ADMIN`), deletes groups where the
  caller is the only member, then deletes the `auth.users` row (FKs cascade the rest). No service
  role needed — keep it atomic; do not reintroduce a multi-step cookie-client + admin-API deletion.

**Scoring** is server-authoritative and stored. The SQL function `score_prediction(...)` is the
single source of truth; `score_fixture(fixture_id)` (service*role only) recomputes a fixture's
scores in one transaction; `recompute_tenant(...)` re-scores after a rule change. `src/lib/scoring/
engine.ts` is a pure TS **mirror** for unit tests + the in-form preview — never authoritative.
Knockout matches are scored on the stored `regular*_`result with the penalty shoot-out goals added
on top;`advancing*team` predictions get a bonus keyed on the actual winner (`winner_team_id`,
post-penalties). **Product decision (updated 2026-06-26, supersedes the 2026-06-20 "shoot-out does
not count" rule): extra time counts AND the penalty shoot-out counts for the result-tip** — the
scored result is the after-extra-time scoreline plus the shoot-out goals (e.g. 1:1 a.e.t., 4:3 on
penalties → scored as 5:4). The addition lives in `score_prediction`(the single source of truth,
which now takes`f_pen_home`/`f_pen_away`); `regular*_`keeps storing the a.e.t. score unchanged.
Note: football-data's`score.fullTime`**folds the shoot-out goals in** (1:1 a.e.t. won 4:3 on pens
is reported as`fullTime`5:4,`penalties`4:3), so`footballDataProvider`subtracts`penalties`back
out of`fullTime`before storing`regular*\*`— otherwise the shoot-out would be double-counted (once
in`regular*\*`, again in `score_prediction`) and the displayed result would read "5:4 n.V.". The
shoot-out independently also feeds the advancing-team bonus. The player-facing wording lives in
`de.ts` (`legal.info.scoring`).

**Sync** (`src/lib/providers/footballData.ts` adapter → `src/lib/sync/run.ts`): idempotent upserts
by `(provider, external_id)`, then `score_fixture` for finished matches. Triggered by an OS/container
timer hitting the secret-protected `POST /api/cron/sync` (Bearer `CRON_SECRET`) or `pnpm sync`. Never
call the provider from request handlers. Local dev/tests use the **openfootball seed**
(`provider = "openfootball"`); production uses the live sync (`provider = "football-data"`).

**Caching & rate limiting** (`src/lib/cache/`, optional — backed by Valkey via `REDIS_URL`; see
`docs/caching.md`): an application-level read-through cache for **global / tenant-uniform** data only
(tournament fixtures+teams, `app_setting`, per-tenant leaderboard), invalidated by tags from the sync
job + admin actions. **Never cache an RLS-scoped/per-user read** — the key has no user in it, so it
would leak across tenants and defeat RLS; cached global reads use the service role deliberately.
Invalidation is application-level (not `revalidateTag`) because the sync also runs as a separate CLI
process. Same store rate-limits `signInAction` + `requestPasswordResetAction`. Absent `REDIS_URL`,
the cache no-ops and limits fail open. Local: `podman compose up -d` (`docker-compose.yml`).

**Push notifications** (Web Push, optional — needs VAPID keys; see `docs/push-notifications.md`):
`src/lib/notifications/dispatch.ts` (service role) runs **after `runSync`** in the cron route, so it
shares the 120 s sync cadence. Two kinds only — a tip reminder ~1 h before kickoff (skips members
who already tipped and view-only groups) and a result push with the member's own points. The
`notification_delivery` ledger (`unique (tenant, user, fixture, kind)`) makes it idempotent across
ticks; dead endpoints (404/410) are pruned. Payloads carry **only the recipient's own data** — never
a fellow member's pre-kickoff tip. Browser subscriptions live in `push_subscription` (own-rows RLS +
MFA gate). Absent VAPID keys the profile toggle hides and the dispatcher no-ops. iOS: installed PWA
only, 16.4+.

## Source layout

```
src/proxy.ts                       # Next 16 proxy: session refresh + auth redirect
src/app/(public)/{login,register}  # auth pages; (public) layout redirects logged-in users home
src/app/(reset)/{forgot-password,reset-password}  # password recovery; (reset) layout does NOT redirect (recovery link signs the user in first)
src/app/(app)/groups/page.tsx      # tenant chooser / "Meine Gruppen" (create / join)
src/app/(app)/profile/page.tsx     # account-wide settings (NOT tenant-scoped); reached from the header user icon
src/app/(app)/[tenantId]/…         # dashboard, matches (tipping), match/[id], leaderboard, tips, admin
src/app/api/cron/sync/route.ts     # secret-protected sync trigger
src/app/(legal)/{info,privacy,imprint}  # public legal/info pages (own chrome; reachable signed-in + out)
src/actions/                       # "use server" mutations (auth, tenant, predictions, profile, admin)
src/components/{ui,...}            # shadcn primitives + feature components
src/lib/{supabase,auth,data,providers,sync,scoring,domain,i18n,cache,notifications,legal}/
src/messages/de.ts                 # all German UI strings
site/                              # GENERATED + git-ignored — public project page for GitHub Pages
supabase/migrations/               # schema + RLS + triggers + functions (source of truth)
supabase/seed.sql                  # GENERATED — edit scripts/generate-seed.ts, not this file
data/openfootball/                 # vendored public-domain WM2026 schedule (seed source)
tests/                             # vitest integration (RLS/deadline/scoring); *.test.ts is unit
```

## Environment

`.env.local` (git-ignored, from `supabase status -o env`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — never `NEXT_PUBLIC_`),
`FOOTBALL_DATA_API_TOKEN` (free key from football-data.org), `FOOTBALL_DATA_COMPETITION` (default
`WC`), `CRON_SECRET`. Optional Web Push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public, build-time +
runtime) + `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (server-only, defaults to `mailto:` +
`OPERATOR_EMAIL`) — generate with `scripts/generate-vapid-keys.ts`. `.env.example` documents the
keys. Env is Zod-validated: public in `src/lib/env.ts`, server-only in `src/lib/env.server.ts`
(guarded by `server-only`).

**Operator identity** (`OPERATOR_NAME` / `_STREET` / `_CITY` / `_COUNTRY` / `_EMAIL`) is
**server-only runtime env**, resolved by `src/lib/legal/operator.ts` and rendered on
`/imprint`, `/privacy` and `/info` — which are therefore `dynamic = "force-dynamic"`, so a
build never bakes one deployment's address into the image. Do NOT move these to `NEXT_PUBLIC_*`
(build-time inlining would publish personal data in the GHCR image) and do NOT put them back in
`de.ts`. All five or none: a partial set counts as unconfigured and the pages say so. The rest of
the legal copy still describes the reference deployment (Hetzner, Supabase Frankfurt, Resend,
BayLDA) — legal text is not configuration, so a fork rewrites it by hand.

## Testing

Integration tests in `tests/` create real auth users and assert RLS isolation (group A cannot read
B), pre-kickoff secrecy, the deadline trigger, scoring, leaderboard ranking, and SQL↔TS scoring
parity. They need the local Supabase stack running and skip themselves if its keys are absent.
