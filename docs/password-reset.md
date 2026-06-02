# Password reset

Self-service "forgot password" flow, built entirely on Supabase Auth. No custom
token or crypto handling — Supabase issues and verifies the recovery token; we
only provide the two pages and the email template.

## Flow

1. **`/forgot-password`** (signed-out): user enters their email →
   `requestPasswordResetAction` calls `supabase.auth.resetPasswordForEmail(email)`.
   For enumeration protection the form _always_ shows the same confirmation
   regardless of whether the address exists, and disables itself after sending.
2. Supabase sends the recovery email. The link points at our existing
   **`/auth/confirm`** route (`verifyOtp`, already type-generic), which verifies
   the `token_hash`, sets the session cookie, and redirects to `next`.
3. **`/reset-password`**: server-checks the session (no recovery session → shows an
   "invalid/expired link" message + "request a new link"). With a session, the
   user sets a new password → `setNewPasswordAction` calls
   `supabase.auth.updateUser({ password })`. No current password is required —
   possession of the emailed token is the proof. The session stays valid, so the
   user continues straight into the app.

### Why `(reset)` is its own route group

`/reset-password` **cannot** live under `(public)`: the recovery link signs the
user in _before_ they reach the page, and the `(public)` layout redirects
signed-in users to `/groups`. The `(reset)` layout is the same centred card
chrome **without** that redirect. Both reset routes are listed in
`PUBLIC_PREFIXES` in `src/proxy.ts` so the proxy never force-redirects them.

## Files

| File                                                      | Role                                              |
| --------------------------------------------------------- | ------------------------------------------------- |
| `src/app/(reset)/layout.tsx`                              | Centred card chrome, no auth redirect             |
| `src/app/(reset)/forgot-password/page.tsx`                | Request page (signed-out)                         |
| `src/app/(reset)/reset-password/page.tsx`                 | Set-new-password page (recovery session)          |
| `src/components/auth/reset-request-form.tsx`              | Email form → `requestPasswordResetAction`         |
| `src/components/auth/new-password-form.tsx`               | Password form → `setNewPasswordAction`            |
| `src/actions/auth.ts`                                     | Both server actions (Zod-validated)               |
| `src/app/auth/confirm/route.ts`                           | Verifies the recovery `token_hash` (pre-existing) |
| `supabase/config.toml` → `[auth.email.template.recovery]` | Local email template wiring                       |
| `supabase/templates/recovery.html`                        | Local recovery email body (token_hash link)       |
| `src/messages/de.ts` → `auth.*`                           | All German UI strings                             |

## Production setup (manual — config only, not code)

`supabase/config.toml` and `supabase/templates/recovery.html` apply **only to the
local stack**. The hosted Supabase project must be configured to match, or the
production link will fall back to the default `ConfirmationURL` flow and never
hit `/auth/confirm` with a `token_hash`:

1. **Authentication → Email Templates → "Reset Password"** — set the link to:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
   ```

2. **Authentication → URL Configuration** — set `Site URL` to the production
   (Hetzner) domain and add it / `/auth/confirm` to the redirect allow-list.

> The signup-confirmation template should already use the same `token_hash` +
> `/auth/confirm` form in the dashboard; recovery now matches it.

## Local testing

```bash
pnpm db:start      # local Supabase (needs DOCKER_HOST set — see CLAUDE.md)
pnpm dev
```

1. Open `/forgot-password`, submit an email of a seeded user.
2. Open Inbucket at <http://127.0.0.1:54324> and click the link in the recovery
   email.
3. You land on `/reset-password` with an active session → set a new password.

`enable_confirmations = false` locally only affects _signup_ confirmation;
recovery emails are sent regardless.
