# Deployment

How to run your own TippKeks instance. All configuration values are documented
in [configuration.md](./configuration.md); this page is the order to do things
in.

> **The project is not actively maintained.** Nobody is watching for a broken
> dependency or a Supabase API change on your behalf. Running this means taking
> over the operations yourself.

## What you need

- A Supabase project (hosted or self-hosted) — Postgres and Auth.
- One machine that can build and run a container.
- A reverse proxy terminating TLS in front of it (Caddy, nginx, Traefik). The app
  binds to loopback and speaks plain HTTP.
- Optionally an SMTP provider wired into Supabase Auth, for confirmation and
  password-reset mail. See [email-smtp.md](./email-smtp.md).

## 1. Prepare the database

Apply the migrations in `supabase/migrations/` to your project, in filename
order — they carry the schema, the RLS policies, the triggers and the scoring
functions. With the Supabase CLI linked to your project:

```bash
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

The RLS policies are the security boundary, not a nice-to-have. An instance
running without them is readable by anyone holding the anon key — which is
everyone, since it ships to the browser.

## 2. Write your configuration

Copy `.env.example` to `.env.prod` and fill it in following
[configuration.md](./configuration.md). `.env.prod` is git-ignored; keep it that
way.

## 3. Supply your legal documents

Put your own `imprint.html` and `privacy.html` in a directory and point
`LEGAL_DIR` at it. The app ships neither — see
[configuration.md → Legal documents](./configuration.md#legal-documents) and the
starting points in [`examples/legal/`](../examples/legal/).

Without them the pages state that no document is configured, which is honest but
unlikely to be what you want on a public site.

## 4. Check it before you build

```bash
pnpm check-config .env.prod --online
```

Catches the mistakes that otherwise surface as a half-working deployment: a
missing service-role key, legal documents that are still the unedited examples, a
half-configured VAPID pair, a typo'd variable name. Exit code 1 on errors, so you
can put it in front of the deploy command.

## 5. Build and run

```bash
podman compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

That builds the image on the machine that runs it and starts three containers:
the app, a Valkey instance for the cache and rate limiting, and a small curl loop
that pokes the sync endpoint every two minutes.

The image is built locally on purpose. There is no published image and no release
workflow: `NEXT_PUBLIC_*` are inlined at build time, so a registry image would be
bound to whoever built it, and publishing one would mean maintaining
release infrastructure for a project that is not maintained.

Check `docker-compose.prod.yml` before the first run — the host path mounted at
`LEGAL_DIR` and the published port are the two things you will want to adjust.

## 6. Make yourself a site admin

```bash
pnpm tsx scripts/set-site-admin.ts <your-email>
```

Needs `SUPABASE_SERVICE_ROLE_KEY` in the environment. This is the only way to
grant it — there is deliberately no self-service path. Site admins can toggle
registration and group creation at `/settings`.

## Continuous integration

[`ci.yml`](../.github/workflows/ci.yml) runs on every push to `main` and every
pull request: install → `typecheck` → `lint` → `format:check` → `test` → `build`.

**It needs no repository configuration.** The build step uses placeholder
Supabase values, because `next build` validates the public env but never contacts
Supabase, and the service-role key is asserted at runtime only — so it never has
to exist in CI, and cannot leak into a build log. A fork gets a green build with
nothing to set up.

Integration tests self-skip without a local Supabase stack, so CI runs the unit
tests only. To run them for real, start a stack inside the workflow and export
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` before `pnpm test`.

### Protecting `main`

The repository ships a ruleset in
[`.github/rulesets/main.json`](../.github/rulesets/main.json): `main` cannot be
deleted or force-pushed, changes land only through a pull request, and `verify`
has to pass on a branch that is up to date. Apply it with:

```bash
gh api --method POST /repos/<owner>/<repo>/rulesets \
  --input .github/rulesets/main.json
```

Rulesets need a **public repository** (or GitHub Pro) — on a private free
repository the call returns 403.

Two deliberate settings. `required_approving_review_count` is **0**: GitHub does
not let you approve your own pull request, so on a single-maintainer repository
any higher number makes `main` permanently unmergeable. The pull-request
requirement still does the real work by ruling out direct pushes. And there are
**no bypass actors**, so the rule applies to the owner too — you can still edit
or disable the ruleset, which is the escape hatch that matters.

## The project page

[`pages.yml`](../.github/workflows/pages.yml) generates the public project page
from `src/messages/de.ts` and deploys it to GitHub Pages. Set Settings → Pages →
Source to **GitHub Actions** once; everything else is derived from the
repository. The generated `site/` directory is git-ignored.

### Custom domain

1. At your DNS provider, point the apex at GitHub Pages — four `A` records
   (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`)
   and, for IPv6, four `AAAA` records (`2606:50c0:8000::153`,
   `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`). For
   `www`, a `CNAME` to `<owner>.github.io` instead.
2. Set the repository Variable `PAGE_URL` to the new URL **with a trailing
   slash**. Canonical, `og:url` and the sitemap are baked in at generation time,
   and the generator derives the `CNAME` file in the artifact from it — which is
   what actually binds the domain to the site. Setting the domain only in the
   repository settings is not enough with workflow publishing: the next deploy
   would ship an artifact without that file.
3. Re-run the workflow, then turn on **Enforce HTTPS** in Settings → Pages once
   GitHub has issued the certificate (can take up to 24 hours).

Do step 1 before step 2. With `PAGE_URL` already switched, the published page
advertises a canonical URL that does not resolve yet.

## Other subsystems

Each optional piece has its own note: [caching.md](./caching.md),
[push-notifications.md](./push-notifications.md),
[sync-scheduler.md](./sync-scheduler.md),
[password-reset.md](./password-reset.md), [email-smtp.md](./email-smtp.md).
