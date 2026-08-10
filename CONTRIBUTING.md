# Contributing

Thanks for looking. TippKeks is a hobby project, so the bar is "does it fit the
existing design", not "is it big enough to matter" — small fixes are welcome.

Security problems do **not** belong in a public issue; see [SECURITY.md](./SECURITY.md).

## Before you start

Open an issue first for anything beyond a bug fix. The data model and the
authorization layer are opinionated, and a pull request that fights them costs
both of us more than a five-line discussion up front.

[`CLAUDE.md`](./CLAUDE.md) documents the architecture in detail — the RLS
policies, the scoring rules, the sync job, and the reasoning behind them. It is
written for AI coding agents, but it is the most complete description of the
system and worth reading before a first change.

## Local setup

See the [README](./README.md#local-development). In short: Node ≥ 22, pnpm, and
a container runtime for the local Supabase stack.

## The conventions that are not negotiable

These are load-bearing. A pull request that breaks one will be sent back.

- **Code, identifiers, comments and commit messages are English. User-facing UI
  text is German.** Never mixed. Every German string lives in
  `src/messages/de.ts`, the single language boundary — no German literals in
  components. A German identifier or an English UI label is a bug.
- **TypeScript strict**, with `noUncheckedIndexedAccess` on. Avoid `any` and
  avoid `!` used to silence the compiler.
- **Server-first.** Reads happen in Server Components through the cookie-aware
  Supabase client. Mutations are Server Actions that Zod-validate their input and
  re-resolve the user, tenant and role. The action is the trust boundary — never
  the form.
- **Authorization is enforced in Postgres.** Server-side checks are
  defence in depth; the non-bypassable gate is Row Level Security. A new tenant
  table without a policy is a security bug, not a TODO.
- **Scoring lives in SQL.** `score_prediction(...)` is the single source of
  truth. The TypeScript engine in `src/lib/scoring/engine.ts` is a mirror for
  tests and the in-form preview — if you change one, change both, and the parity
  test will tell you if you didn't.

## Before opening a pull request

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

CI runs exactly these plus `pnpm build`. The integration tests skip themselves
without a local Supabase stack, so please run them with one (`pnpm db:start`)
when you touch anything near RLS, the deadline trigger or scoring — those are
the tests that would catch a real regression.

After a schema change, add a migration under `supabase/migrations/` (never edit
an applied one) and regenerate types with `pnpm db:types`.

`supabase/seed.sql` is generated — edit `scripts/generate-seed.ts` instead.

## Commits and pull requests

Write commit messages in English, in the imperative ("Add …", "Fix …"), and
explain _why_ in the body when the change is not self-evident. Keep a pull
request to one topic and describe what a reviewer should look at.

## Licence

By contributing you agree that your contribution is licensed under the
[MIT License](./LICENSE).
