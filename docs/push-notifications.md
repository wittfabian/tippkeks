# Push notifications (Web Push)

TippKeks can send two **Web Push** notifications to installed PWAs:

- a **tip reminder** ~1 hour before kickoff when a member has not tipped yet, and
- a **result** push once a fixture is finished, including the member's own points.

Both are server-driven from the existing sync cron and carry only the recipient's own data — never
another player's tip (see constraint 1 in `docs/social-features.md`).

## How it works

- **Service worker** (`public/sw.js`): a `push` listener renders the notification; `notificationclick`
  opens/focuses the target match page.
- **Subscription**: the profile page (`/profile`) has a toggle (`NotificationToggle`). On a user
  gesture it requests permission and subscribes via the Push API, then stores the subscription
  through `savePushSubscriptionAction` in the `push_subscription` table (RLS: own rows only).
- **Dispatch** (`src/lib/notifications/dispatch.ts`, service role): runs after `runSync` in
  `POST /api/cron/sync`, so it fires on the same 120 s cadence as the sync sidecar. The
  `notification_delivery` ledger (`unique (tenant_id, user_id, fixture_id, kind)`) makes it
  idempotent across ticks; dead subscriptions (HTTP 404/410) are pruned automatically.
- **Reminders** skip members in a **view-only** group (`member_tipping_enabled = false`) — they
  cannot tip, so reminding them is wrong.

## Setup

Push is **optional**: without VAPID keys the toggle hides itself and the dispatcher no-ops (like the
cache without `REDIS_URL`).

1. Generate a VAPID key pair once:

   ```bash
   pnpm tsx scripts/generate-vapid-keys.ts
   ```

2. Set the env vars (see `.env.example`):

   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>   # reaches the browser
   VAPID_PRIVATE_KEY=<private>             # server-only
   VAPID_SUBJECT=mailto:you@example.com    # optional, defaults to a mailto
   ```

   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined into the bundle at build time, so it must be present at
   **build** as well as runtime.

## Platform caveats

- **iOS/iPadOS**: Web Push works **only** for a PWA added to the home screen, on **iOS 16.4+**, and
  the permission prompt must come from a user gesture. Users who only open the site in a Safari tab
  get nothing. The toggle shows a hint to this effect.
- **Android / desktop** (Chrome, Edge, Firefox): works whether installed or in the browser.
- Delivery is **best-effort**, not guaranteed or instant — fine for a 1 h-ahead reminder and a
  result push. iOS may drop a subscription if the PWA is unused for a long time; re-enabling from
  the profile re-subscribes.

## Local testing

The service worker only registers in a production build (`ServiceWorkerRegister` is a no-op in dev),
so end-to-end push needs `pnpm build && pnpm start` over HTTPS (or `localhost`, a secure context).
The dispatcher logic is covered headlessly by `tests/notifications.integration.test.ts`, which
injects a fake sender to assert recipient selection, ledger dedup, view-only exclusion, the
result-with-points payload, and dead-subscription pruning.
