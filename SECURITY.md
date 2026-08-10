# Security policy

TippKeks is a small, non-commercial side project. There is no bug bounty and no
guaranteed response window — but security reports are taken seriously and fixed
with priority, because the whole design rests on the database refusing what the
UI merely hides.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting instead: go to the repository's
**Security** tab → **Report a vulnerability**. That opens a private advisory
visible only to the maintainers, where a fix can be prepared before disclosure.

Helpful in a report: what an attacker can reach that they should not, the steps
to get there, and the version or commit you tested.

## What is in scope

The interesting attack surface is authorization, and it is enforced in Postgres:

- **Cross-tenant access** — reading or writing data of a group you are not a
  member of, whether through the REST API with an anon key or through the app.
- **Row Level Security bypass** — any path that returns rows a policy should
  have filtered. A tenant table with RLS enabled but no policy, or a helper that
  reintroduces recursion, counts as a vulnerability even without a live exploit.
- **Prediction secrecy** — reading another member's prediction before kickoff.
- **Deadline bypass** — submitting or editing a prediction after kickoff. The
  deadline is a database trigger comparing against the database clock; anything
  that circumvents it is in scope.
- **Privilege escalation** — becoming a group admin or site admin without being
  granted it, or reaching a service-role code path from a user session.
- **MFA step-up bypass** — acting with an `aal1` session while a verified factor
  exists.
- **Authentication issues** — session fixation, token leakage, account takeover
  via the invite or password-reset flows.
- **Secret exposure** — any way the service-role key, `CRON_SECRET` or the VAPID
  private key reaches a client bundle, a log, or a build artifact.

## What is out of scope

- Misconfiguration of your own deployment (a missing RLS migration, a
  service-role key handed to the browser, an open Supabase project).
- Findings from automated scanners with no demonstrated impact.
- Missing hardening headers or rate limits without a concrete attack.
- Social engineering, physical access, or attacks on GitHub and Supabase
  themselves.
- Denial of service through sheer volume.

## Supported versions

Only `main` is supported. There are no backports to older tags — self-hosters
should track the latest release image.
