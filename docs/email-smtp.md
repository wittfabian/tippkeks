# Email / SMTP setup

A public instance needs its own mail provider. Even with signup confirmation off,
the app sends real mail:

- **Password reset** (`/forgot-password`) — sends a recovery link.
- **Email change** (`double_confirm_changes = true`) — sends a confirmation link.

Supabase's built-in sender is capped at roughly 2 mails an hour and lands in
spam, so it is fine for development and not for anything else. Custom SMTP fixes
both the limit and deliverability.

None of this touches the app: Supabase Auth (GoTrue) sends the mail, so it is
configured in the Supabase Dashboard and in `supabase/config.toml`.

The walkthrough below uses **Resend** because that is what the reference
deployment used — any SMTP provider works, and the steps map directly.

> Whichever provider you pick becomes a processor of your users' email addresses.
> Your privacy policy has to name it (see
> [configuration.md → Legal documents](./configuration.md#legal-documents)), and
> for a provider outside the EU you need to say what the transfer is based on.

---

## How-to

### 1. Domain verification + DNS

In the Resend dashboard → **Domains** → add your sending domain. Resend then shows
the exact records to create at your DNS provider — typically:

- an **MX** record for the return-path subdomain,
- a **TXT (SPF)** record (`v=spf1 include:amazonses.com ~all` or Resend's variant),
- one or more **DKIM** records (TXT/CNAME).

Add them verbatim from the dashboard (don't copy values from here — they're
per-domain) and wait for Resend to mark the domain **Verified**. Without this,
mail either won't send or will be spam-filtered.

### 2. Supabase Dashboard SMTP (production)

Resend's SMTP credentials are fixed:

| Field    | Value                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Host     | `smtp.resend.com`                                                      |
| Port     | `587` (STARTTLS) or `465` (SSL)                                        |
| Username | `resend`                                                               |
| Password | your Resend API key (`re_…`)                                           |
| Sender   | an address **on the verified domain**, e.g. `noreply@mail.example.org` |

Dashboard → **Authentication → Emails → SMTP Settings** → enable custom SMTP and
fill these in. Set the sender name to `TippKeks`.

> Reminder from `config.toml`: also confirm the **recovery email template** in
> Dashboard → Authentication → Email Templates → Reset Password — `config.toml`
> only governs the local stack.

### 3. Rate limit

Dashboard → **Authentication → Rate Limits** → raise _"Rate limit for sending
emails"_ well above the default `2`/hour (e.g. `30`+). This is the hosted
equivalent of `auth.rate_limit.email_sent` in `config.toml`.

### 4. `config.toml` (local stack)

Replace the commented SendGrid example (around line 248) with:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 587
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "noreply@mail.example.org"
sender_name = "TippKeks"
```

And raise the local limit so testing isn't throttled:

```toml
[auth.rate_limit]
email_sent = 30
```

> Local dev still captures mail in Mailpit unless SMTP is enabled — only turn this
> on locally if you actually want to send through Resend from your machine.

### 5. Env

Only needed if you enabled SMTP for the local stack in step 4 — put it in
`.env.local`:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

Deliberately absent from `.env.example`: the app never reads it. It is consumed
by the Supabase CLI (`config.toml`'s `env(RESEND_API_KEY)`), and in production by
the value you paste into the Dashboard — not by the container.

---

## Verify

After steps 1–3, trigger a real send and confirm delivery:

1. On `/forgot-password`, request a reset for a real inbox → the mail should
   arrive from your verified domain (check it's **not** in spam).
2. In Resend → **Logs**, confirm the message shows as delivered.

## Related

- Invite links auto-redeem only while `enable_confirmations = false`. If you turn
  email confirmation **on** for production, the shared-invite flow loses its code
  on the confirmation-link click and needs a cookie bridge — see the invite-link
  implementation before flipping that flag.
- `docs/password-reset.md` — the recovery-link flow these emails carry.
