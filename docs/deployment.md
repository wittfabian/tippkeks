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

## 4. Build and run

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

## 5. Make yourself a site admin

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

If you want the check enforced, add a branch protection rule on `main` requiring
`verify` (Settings → Branches).

## The project page

[`pages.yml`](../.github/workflows/pages.yml) generates the public project page
from `src/messages/de.ts` and deploys it to GitHub Pages. Set Settings → Pages →
Source to **GitHub Actions** once; everything else is derived from the
repository. The generated `site/` directory is git-ignored.

For a custom domain, set the repository Variable `PAGE_URL` to the URL the page
will be served under **before** pointing the domain at it — canonical, `og:url`
and the sitemap are baked in at generation time.

## Other subsystems

Each optional piece has its own note: [caching.md](./caching.md),
[push-notifications.md](./push-notifications.md),
[sync-scheduler.md](./sync-scheduler.md),
[password-reset.md](./password-reset.md), [email-smtp.md](./email-smtp.md).
