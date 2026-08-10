# TippKeks

[![CI](https://github.com/wittfabian/tippkeks/actions/workflows/ci.yml/badge.svg)](https://github.com/wittfabian/tippkeks/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-e0a458.svg)](./LICENSE)

A self-hostable football prediction game ("Tippspiel") for closed friend groups.
Members predict the score of each fixture before kickoff, real results are synced
automatically, points are computed in the database, and a leaderboard settles the
argument.

Built for the FIFA World Cup 2026 and used for exactly that. The tournament is
over, the code is open — the data model was never tied to it.

> **The UI is German.** Code, identifiers and documentation are English; every
> user-facing string lives in `src/messages/de.ts`. Another language means adding
> a second dictionary, not hunting literals through components.

## What it does

- **Predictions are sealed until kickoff.** Others see your prediction only after
  the match starts, and the deadline is a database trigger comparing against the
  database clock — not a disabled button.
- **Points are computed server-side.** Exact score, goal difference, and tendency,
  plus a bonus for correctly predicting who advances. Rule sets are versioned and
  configurable per group; a rule change re-scores retroactively.
- **One group per circle of friends.** Join by invite link, each group with its
  own leaderboard and admins. That no group can read another's predictions is
  enforced by Postgres Row Level Security, not by the UI.
- **Results sync themselves.** An idempotent job pulls fixtures and results from
  football-data.org and re-scores finished matches.
- **Installable as a PWA**, with optional Web Push: a reminder when a prediction
  is still missing, and your own points once a match is final.
- **Admin tooling** for the realities of a friend group: managed members without
  an account, manual result overrides, and an audit log of both.

## Architecture in one paragraph

Server-first Next.js: reads happen in Server Components through a cookie-aware
Supabase client, mutations are Server Actions that validate with Zod and
re-resolve the caller's identity and role. Authorization is defence in depth
across three layers, and the last one is not bypassable — RLS policies in
Postgres. Scoring lives in SQL (`score_prediction`) with a TypeScript mirror used
only for tests and the in-form preview. [`CLAUDE.md`](./CLAUDE.md) documents all
of it, including the footguns.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · pnpm ·
Tailwind v4 + shadcn/ui · Supabase (Postgres + Auth) · Podman/Docker.

## Local development

Prerequisites: Node ≥ 22, pnpm (`corepack enable`), and Podman or Docker (runs the
local Supabase stack and Valkey).

```bash
pnpm install
export DOCKER_HOST="unix:///var/run/docker.sock"   # let the Supabase CLI reach Podman
pnpm db:start                                       # local Postgres + Auth
pnpm exec supabase status -o env                    # API URL + keys
cp .env.example .env.local                          # then fill in the values above
pnpm dev                                            # http://localhost:3000
```

Seeded with the public-domain openfootball World Cup 2026 schedule, so there is a
full fixture list without an API token. `pnpm tsx scripts/seed-mock.ts` adds mock
players, predictions and finished results if you want a populated leaderboard.

Common scripts:

| Command          | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `pnpm typecheck` | `tsc --noEmit`                                                |
| `pnpm lint`      | ESLint                                                        |
| `pnpm test`      | Vitest (integration tests need the local stack; else skipped) |
| `pnpm build`     | Production build                                              |
| `pnpm db:reset`  | Rebuild the local DB from migrations + seed                   |
| `pnpm db:types`  | Regenerate `database.types.ts` after a schema change          |
| `pnpm sync`      | Run the football-data.org sync once                           |

The full list is in [`CLAUDE.md`](./CLAUDE.md#commands).

## Self-hosting

You need a Supabase project (or a self-hosted Supabase) and somewhere to run one
container. Apply the migrations in `supabase/migrations/`, pull the published
image from GHCR, and inject the runtime configuration.

Two things are easy to get wrong and worth reading before you go live:

1. **The operator details** (`OPERATOR_NAME`, `_STREET`, `_CITY`, `_COUNTRY`,
   `_EMAIL`) are runtime configuration, so the published image contains nobody's
   address. Without them the legal pages state that no operator is configured.
2. **The legal texts describe the reference deployment.** Hosting provider,
   mail provider and supervisory authority are baked into the German copy —
   rewrite them for your setup.

Details: [`docs/deployment.md`](./docs/deployment.md). Optional subsystems have
their own notes under [`docs/`](./docs) — caching, push notifications, SMTP,
password reset, and the sync scheduler.

## Contributing

Issues and pull requests are welcome; please read
[`CONTRIBUTING.md`](./CONTRIBUTING.md) first — a few conventions are load-bearing.

Found a security problem? Do not open a public issue — see
[`SECURITY.md`](./SECURITY.md).

## Licence

[MIT](./LICENSE). The bundled fixture data under `data/openfootball/` is public
domain.
