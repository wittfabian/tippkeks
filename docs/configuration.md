# Configuration

Everything you can set when running TippKeks, in one place. Nothing here lives
in the code: the repository ships no keys, no operator details and no legal
texts, so a fresh clone is inert until you configure it.

Locally these go in `.env.local`; in production in `.env.prod` (both
git-ignored). [`.env.example`](../.env.example) lists the keys with one-line
hints.

> **Nothing needs to be configured on GitHub.** CI builds with placeholder values
> and the project-page workflow derives what it needs, so a fork gets a green
> build with zero setup. See [deployment.md](./deployment.md).

## Checking it

```bash
pnpm check-config                     # .env.local
pnpm check-config .env.prod           # before a deployment
pnpm check-config .env.prod --online  # also verify the Supabase keys are accepted
```

It reports every variable as present, missing or implausible, and makes the
checks a schema cannot: that `LEGAL_DIR` really holds both documents and that
they are not still the unedited examples, that the service-role key is not the
anon key pasted twice, that the VAPID pair is not half-configured, and that no
key in the file is an unrecognised typo. Exit code 1 on errors, 0 on warnings
only, so it can gate a deploy script.

`--online` is skipped against a local stack on purpose: the Supabase CLI's
gateway accepts any API key, so the probes would come back green regardless. On a
hosted project it verifies that the anon key is accepted and that the
service-role key really reaches the admin API.

## Required

| Variable                        | What it is                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL. **Build time** — inlined into the client bundle.                                                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key. **Build time**. Not secret; it ships to every browser and RLS is what protects the data.                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only key that **bypasses RLS**. Used by the sync job, admin overrides and managed members. Never expose it to the browser, never prefix it `NEXT_PUBLIC_`. |

Local values come from `pnpm exec supabase status -o env`. For a hosted project,
take the URL and anon key from Settings → API, and a Secret key (`sb_secret_…`)
from Settings → API Keys.

Build-time variables must be present when the image is built. In
`docker-compose.prod.yml` they are build args read from your `.env.prod`.

## Public deployment

Skip these locally; a deployment reachable from the internet needs them.

| Variable                             | What it is                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                           | Canonical public origin, e.g. `https://example.org`. Without it, confirmation and password-reset links point at the container's internal address instead of your domain.                                                                                                                          |
| `LEGAL_DIR`                          | Directory holding your `imprint.html` and `privacy.html`. See [Legal documents](#legal-documents).                                                                                                                                                                                                |
| `OPERATOR_EMAIL`                     | Contact address shown on the info page, and the contact the push services require.                                                                                                                                                                                                                |
| `CRON_SECRET`                        | Bearer token guarding `POST /api/cron/sync`. Generate with `openssl rand -hex 32`. Without it the endpoint stays closed and results never refresh on their own.                                                                                                                                   |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Encrypts arguments bound to Server Actions. `openssl rand -base64 32`. **Build time and runtime, and the same value in both.** Keep it stable across releases, or every deployment invalidates in-flight forms with "Failed to find Server Action". Mandatory once you run more than one replica. |

## Optional

| Variable                                                          | Effect when unset                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FOOTBALL_DATA_API_TOKEN`                                         | No live result sync — fixtures and scores stay as seeded or as an admin enters them. Free token from [football-data.org](https://www.football-data.org/client/register).                          |
| `FOOTBALL_DATA_COMPETITION`                                       | Defaults to `WC` (FIFA World Cup).                                                                                                                                                                |
| `REDIS_URL` / `REDIS_PASSWORD`                                    | Cache no-ops (reads fall through to Postgres) and auth rate limits fail open. Supply `REDIS_URL` locally; in production supply `REDIS_PASSWORD` and the URL is assembled for the compose network. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (build time) + `VAPID_PRIVATE_KEY` | No push notifications — the profile toggle hides itself and the dispatcher does nothing. Generate a pair with `pnpm tsx scripts/generate-vapid-keys.ts`.                                          |
| `VAPID_SUBJECT`                                                   | Defaults to `mailto:` + `OPERATOR_EMAIL`. Set it only to use a different contact than the one on the info page.                                                                                   |

## Legal documents

**This section describes configuration, not legal requirements. It is not legal
advice.**

TippKeks ships no Impressum and no privacy policy, on purpose. Such a text names
a specific hosting provider, a specific mail provider and a specific supervisory
authority — shipped with the app, it would give every self-hoster a document that
is false for them.

So you supply your own. Put two HTML fragments in a directory and point
`LEGAL_DIR` at it:

```
/srv/tippkeks/legal/imprint.html    → served at /imprint
/srv/tippkeks/legal/privacy.html    → served at /privacy
```

Fragments only — no `<html>`, `<head>` or `<body>`. Use `<h2>` for section
headings plus `<p>`, `<ul>`, `<address>` and `<a>`; the app styles them to match
the UI. Changes take effect on the next request, with no restart.

Without `LEGAL_DIR`, or with a file missing, the routes render a notice that the
document is not configured. The app never invents one.

[`examples/legal/`](../examples/legal/) holds the documents of the reference
deployment as a starting point, with the operator details replaced by
placeholders. They are examples, not templates to publish unchanged — whether a
given text is correct and complete for your deployment is a question only you, or
a lawyer, can answer.

Because the files are inserted into the page as-is, treat them as part of your
deployment configuration: do not let anyone edit them who could not already
change the site.

## Site administrators

Site admins (operators of the whole install, as opposed to per-group admins) are
granted out of band — there is no self-service path, by design:

```bash
pnpm tsx scripts/set-site-admin.ts <email>            # grant
pnpm tsx scripts/set-site-admin.ts <email> --revoke   # revoke
```

Needs `SUPABASE_SERVICE_ROLE_KEY`. Site admins can toggle registration and group
creation at `/settings`.

## The project page

Only relevant if you publish the GitHub Pages project page.
`scripts/generate-landing.ts` reads:

| Variable      | What it is                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PAGE_URL`    | Required. Canonical URL the page is served under, with trailing slash. Feeds `<link rel="canonical">`, `og:url` and the sitemap, so a wrong value points search engines at a page that does not exist. |
| `REPO_URL`    | Required. Repository the page links to.                                                                                                                                                                |
| `IMPRINT_URL` | Optional. Adds an "Impressum" link to the footer, pointing wherever yours lives.                                                                                                                       |

The workflow fills in `PAGE_URL` and `REPO_URL` from the repository itself, so
this is only something you touch for a custom domain — set a repository Variable
`PAGE_URL` before pointing a domain at the page.
