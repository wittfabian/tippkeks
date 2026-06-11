# Password reset

Self-service "forgot password" flow, built entirely on Supabase Auth. No custom
token or crypto handling — Supabase issues and verifies the recovery token; we
only provide the two pages and the email template.

## Flow

1. **`/forgot-password`** (signed-out): user enters their email →
   `requestPasswordResetAction` calls `supabase.auth.resetPasswordForEmail(email)`.
   For enumeration protection the form _always_ shows the same confirmation
   regardless of whether the address exists, and disables itself after sending.
2. Supabase sends the recovery email. The link points **directly at
   `/reset-password?token_hash=…&type=recovery`** — _not_ at `/auth/confirm`.
3. **`/reset-password`**: the page renders the new-password form whenever a
   `token_hash` is present (or a session already exists). It does **not** verify
   the token — rendering must stay side-effect-free (see below). The form carries
   the `token_hash` in a hidden field.
4. On submit, `setNewPasswordAction` calls `supabase.auth.verifyOtp({ type:
"recovery", token_hash })` (this spends the single-use token and sets the
   session), then `supabase.auth.updateUser({ password })`. No current password is
   required — possession of the emailed token is the proof. The session stays
   valid, so the user continues straight into the app.

### Why the token is verified on submit, not on a GET

The recovery `token_hash` is **single-use**. Email security gateways and browser
prefetchers routinely issue a `GET` on links _before_ the human clicks. If that
`GET` verifies the token (the old `/auth/confirm` design), it spends it, and the
user's real click lands on a dead "invalid/expired" page. Verifying only on the
form **`POST`** — which scanners don't trigger — closes that hole. Consequently
`/reset-password` must never call `verifyOtp` during render; it only reads
`getClaims()` (which does not consume a recovery OTP) to decide the legacy
session branch.

`/auth/confirm` still verifies `token_hash` for **signup confirmation** and
**email-change** links (their click is _meant_ to establish a session and land in
the app, and they carry no follow-up form). On a recovery-type failure it now
redirects to `/reset-password` (the "request a new link" UI) rather than `/login`.
In-flight legacy recovery links that still point at `/auth/confirm` keep working:
it sets the session and redirects to `/reset-password`, which then shows the form
via the session branch (no `token_hash` needed).

### Why `(reset)` is its own route group

`/reset-password` **cannot** live under `(public)`: a logged-in user (or the
legacy `/auth/confirm` path) may reach it with a session, and the `(public)`
layout redirects signed-in users to `/groups`. The `(reset)` layout is the same
centred card chrome **without** that redirect. Both reset routes are listed in
`PUBLIC_PREFIXES` in `src/proxy.ts` so the proxy never force-redirects them.

## Files

| File                                                      | Role                                            |
| --------------------------------------------------------- | ----------------------------------------------- |
| `src/app/(reset)/layout.tsx`                              | Centred card chrome, no auth redirect           |
| `src/app/(reset)/forgot-password/page.tsx`                | Request page (signed-out)                       |
| `src/app/(reset)/reset-password/page.tsx`                 | Set-new-password page (renders on `token_hash`) |
| `src/components/auth/reset-request-form.tsx`              | Email form → `requestPasswordResetAction`       |
| `src/components/auth/new-password-form.tsx`               | Password form (hidden `token_hash`) → action    |
| `src/actions/auth.ts`                                     | Both server actions (verifyOtp + updateUser)    |
| `src/app/auth/confirm/route.ts`                           | Signup/email-change verify; recovery fallback   |
| `supabase/config.toml` → `[auth.email.template.recovery]` | Local email template wiring                     |
| `supabase/templates/recovery.html`                        | Local recovery email body (token_hash link)     |
| `src/messages/de.ts` → `auth.*`                           | All German UI strings                           |

## Production setup (manual — config only, not code)

`supabase/config.toml` and `supabase/templates/recovery.html` apply **only to the
local stack**. The hosted Supabase project must be configured to match, or the
production link will fall back to the default `ConfirmationURL` flow and the
verify-on-submit protection is lost:

1. **Authentication → Email Templates → "Reset Password"** — set the link to:

   ```
   {{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery
   ```

2. **Authentication → URL Configuration** — set `Site URL` to the production
   (Hetzner) domain and add `/reset-password` to the redirect allow-list.

> The signup-confirmation template still uses the `token_hash` + `/auth/confirm`
> form (its click is meant to sign in directly); only **recovery** points at
> `/reset-password`, because it leads to a form that spends the token on submit.

## Local testing

```bash
pnpm db:start      # local Supabase (needs DOCKER_HOST set — see CLAUDE.md)
pnpm dev
```

1. Open `/forgot-password`, submit an email of a seeded user.
2. Open Mailpit at <http://127.0.0.1:54324> and click the link in the recovery
   email.
3. You land on `/reset-password` (the link carries `token_hash`) → set a new
   password; the token is verified and spent on submit.

`enable_confirmations = false` locally only affects _signup_ confirmation;
recovery emails are sent regardless.
