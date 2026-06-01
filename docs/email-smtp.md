# Email / SMTP setup (Resend)

**Status:** the privacy policy already names Resend as a processor
(`de.legal.privacy.recipientsEmail`), but **no email actually flows through Resend
yet** — the SMTP wiring below is still open. Until it's done, auth emails fall back
to Supabase's built-in sender, which is capped at ~2 mails/hour and lands in spam.

## Why this matters

Even with `enable_confirmations = false` (signup sends no confirmation), the app
still sends real mail today:

- **Password reset** (`/passwort-vergessen`) — implemented, sends a recovery link.
- **Email change** (`double_confirm_changes = true`) — sends a confirmation link.

So the 2-mails/hour built-in limit will bite at launch. A custom SMTP provider
fixes both the limit and deliverability.

## Provider

**Resend** — legal entity Plus Five Five, Inc., San Francisco, USA. EU-US Data
Privacy Framework certified + EU SCCs (already reflected in the privacy policy).
Free tier: 3,000 mails/month.

---

## Open TODOs

- [ ] **1. Verify a sending domain in Resend** (e.g. `mail.tippkeks.de`) and add the
      DNS records Resend generates for it (see below).
- [ ] **2. Configure custom SMTP in the hosted Supabase Dashboard** — the only step
      that takes effect in production.
- [ ] **3. Raise the auth email rate limit** in the Dashboard (default is 2/hour).
- [ ] **4. Mirror the SMTP block in `supabase/config.toml`** so the local stack and
      a `db reset`/CI stay consistent.
- [ ] **5. Add `RESEND_API_KEY` to `.env.local` / `.env.prod` and to `.env.example`.**

These are independent of code — no app changes are needed; Supabase Auth (GoTrue)
sends the mail once SMTP is set.

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
| Sender   | an address **on the verified domain**, e.g. `noreply@mail.tippkeks.de` |

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
admin_email = "noreply@mail.tippkeks.de"
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

Add to `.env.local`, `.env.prod`, and document it in `.env.example`:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

The app itself never reads this — only the Supabase CLI (`config.toml`'s
`env(RESEND_API_KEY)`) and, separately, the value you paste into the Dashboard.

---

## Verify

After steps 1–3, trigger a real send and confirm delivery:

1. On `/passwort-vergessen`, request a reset for a real inbox → the mail should
   arrive from your verified domain (check it's **not** in spam).
2. In Resend → **Logs**, confirm the message shows as delivered.

## Related

- Invite links auto-redeem only while `enable_confirmations = false`. If you turn
  email confirmation **on** for production, the shared-invite flow loses its code
  on the confirmation-link click and needs a cookie bridge — see the invite-link
  implementation before flipping that flag.
- `docs/password-reset.md` — the recovery-link flow these emails carry.
