# Social / "togetherness" features — concept roadmap

The app today is **"tip alone → read the result."** Every step is private or task-focused
(countdown, "you tipped 2:1"), and the only social signal is the live banner plus the all-tips
table that appears _after_ kickoff. There is no activity, no reactions, no shared real-time
moment.

This document is a concept roadmap (no code yet) for closing that gap. It is organised around the
**emotional arc of a single match** — before kickoff (anticipation), during the match (fevering
together), after (shared celebration) — plus a cross-cutting identity/rivalry layer.

## Guiding constraints (non-negotiable)

These shape every feature below; an idea that violates one is out.

1. **No email / no push.** Explicit product decision. Every "notification", nudge or alert is an
   **in-app** signal only — visible when the user has the app open. No transactional mail, no web
   push. (See `docs/email-smtp.md`: mail is reserved for auth/invites.)
2. **Pre-kickoff secrecy is DB-enforced.** The `prediction` SELECT policy only reveals another
   member's prediction once `fixture.kickoff_at <= now()` (owner/admin always). Any pre-kickoff
   feature may show **aggregate numbers only** ("5 von 8 haben getippt"), never content. A count
   that leaks a tendency is a bug.
3. **RLS is the final gate.** Every new tenant-scoped table enables RLS, ships a member policy, and
   ANDs on the restrictive `*_require_mfa` gate (same pattern as `prediction`). A table with RLS on
   and no policy is locked; without RLS it is wide open to the anon key.
4. **Server-first.** Reads via the cookie-aware client in Server Components; writes via
   `"use server"` actions that Zod-validate and re-resolve user/tenant/role. The action is the trust
   boundary, not the form.
5. **Multi-event ready.** Anchor everything to `fixture` / `prediction_score`, never to WM2026.
6. **German UI text lives only in `src/messages/de.ts`.** New surfaces add new top-level keys
   (`activity`, `reactions`, `comments`, `live`, `recap`, `duel`); no inline German literals.

## Current building blocks (what we already have to lean on)

- `fixture_status` enum: `scheduled · live · finished · postponed · abandoned · cancelled`.
  `fixture.kickoff_at` is the secrecy / deadline pivot; the DB clock is authoritative.
- `prediction` (one row per user×fixture): `home_goals, away_goals, advancing_team_id, updated_at`.
  Visible to other members **only after kickoff** — which is exactly when the live phase begins, so
  the live table below is allowed to read everyone's picks.
- `prediction_score` (per finished prediction): `points, category` where category ∈
  `exact · goal_diff · tendency · …`. Written only by the `score_fixture` definer / service role.
- `leaderboard` view (`security_invoker`): per-tenant ranked aggregate
  (`total_points, exact_count, hit_count, rank, last_prediction_at`). Read via service role in
  `src/lib/data/leaderboard.ts`, cached 60 s under tags `leaderboard` + `leaderboard:<id>`.
- `src/lib/scoring/engine.ts`: pure TS **mirror** of the SQL scorer — already used for the in-form
  preview. This is what lets us compute _projected_ points live without touching the DB scorer.
- Existing live UX: the leaderboard page lists in-play matches and re-renders every 60 s (polling).
  No Supabase Realtime is wired up yet.

---

## Area 1 — Before kickoff: "we're tipping together right now"

**Problem.** You tip in a vacuum. You don't feel the group. The form is silent.

### 1a. Tip-pulse per fixture (cheapest visible win) — ✅ SHIPPED

Show "5 von 8 haben getippt" on each open match card and on the match detail page — **before**
kickoff, as an aggregate only.

- **Data (as built).** No new table, **no RPC**. Instead of a definer RPC we followed the
  `leaderboard.ts` precedent: `getTipPulse(tenantId)` in `src/lib/data/tip-pulse.ts` reads with the
  **service role** and a `tenant_id` filter, selecting **only `fixture_id`** (never the goals) plus a
  `tenant_member` count. Counts only → pre-kickoff secrecy holds even though the service role could
  see content. Access is gated by the page's `requireMembership(tenantId)`; the per-tenant cache key
  means N members polling collapse to ~one DB read (the polling-design win), which an RPC wouldn't
  give.
- **Caching (as built).** Tenant-uniform, cached 30 s under tags `tip-pulse` + `tip-pulse:<tenant>`,
  invalidated on every prediction write — both `submitPredictionAction` and the admin
  `saveMemberTipsAction`.
- **Files (as built).** `src/lib/data/tip-pulse.ts`; `src/app/(app)/[tenantId]/matches/page.tsx` +
  `src/components/match/match-card.tsx` (pulse pill, pre-kickoff only); the match detail header
  (`match/[fixtureId]/page.tsx`); `src/actions/{predictions,admin}.ts` (cache invalidation);
  `de.ts` → `predictions.pulse` / `predictions.pulseTitle`.
- **UI (as built).** A small dot + "5/8 getippt" in the card's meta row (only while open); the match
  detail header reuses `predictions.submittedCount` pre-kickoff.

### 1b. Group deadline ritual on the dashboard — ✅ SHIPPED

The dashboard shows _your_ open tips. A group line now reads "Heute sind in der Gruppe noch 6 Tipps
offen". Turns the personal todo into collective momentum.

- **Data (as built).** Derived from `getTipPulse`: sum of `members − tipped` over fixtures still open
  **and closing today** (Berlin day) — bounded and motivating, not the whole-tournament backlog.
- **Files (as built).** `src/app/(app)/[tenantId]/page.tsx`; `de.ts` → `dashboard.groupPace`.

### 1c. In-app nudge (no email!)

Let a member surface "Anna fehlt noch für DEU–BRA" as an **in-app** marker — e.g. it appears in
Anna's activity feed / dashboard banner next time she opens the app. No mail, no push.

- **Data.** A lightweight `nudge` row (`tenant_id, fixture_id, from_user, to_user, created_at`) or
  fold it into the activity feed (Area 3) as a `nudge` event type targeted at one user.
- **RLS.** Insert: member of tenant, `from_user = auth.uid()`, target is a co-member. Select: target
  user or admin. One nudge per (from,to,fixture) — unique index to avoid spam.
- **Files.** `src/actions/predictions.ts` (or new `src/actions/social.ts`); `de.ts` → `nudge`.
- **Open question.** Is the nudge worth its own table, or just an activity event? Lean: activity
  event (Area 3) to avoid a near-empty table.

---

## Area 2 — During the match: the actual "fiebern" (biggest gap, biggest payoff)

**Problem.** While a match is live, nothing happens but a 60 s table refresh. This is the heart of
"we fever toward the result" and it is currently empty.

### 2a. Live table that moves with the score (the centrepiece) — ✅ SHIPPED

While a fixture is `live` with a score, the match detail page shows everyone's **projected** points
at the current scoreline, sorted, re-sorting with every goal — _our_ mini-league moving in real time.

- **Data (as built).** No new table. After kickoff the `prediction` SELECT policy reveals all
  members' picks (read via the member's cookie client). `src/lib/scoring/engine.ts` (the TS mirror)
  computes the provisional points from the live `regular_home/away` score; `src/lib/data/
scoring-config.ts#getScoringConfig` supplies the tenant's active rule set. `prediction_score`
  stays untouched (written only at full time) — the projection is **display-only**.
- **Refresh (as built).** `src/components/match/live-refresher.tsx` calls `router.refresh()` every
  45 s, **only while the tab is visible** and only while the server still renders a live fixture (so
  it self-terminates at full time). No Realtime, no cache (per-request read).
- **Files (as built).** `src/app/(app)/[tenantId]/match/[fixtureId]/page.tsx` (live branch:
  `useProjection = isLive && hasResult`, LIVE header indicator, "Zwischenstand" label + note);
  `src/lib/data/scoring-config.ts`; `src/components/match/live-refresher.tsx`; `de.ts` →
  `predictions.liveProjection` / `liveProjectionNote`.
- **Edge cases (handled).** Knockout matches project on the 90-minute (`regular`) score via the same
  engine; the `advancing_team` bonus passes `resWinner: null` mid-match (not decided yet), so it
  only resolves at full time.
- **Future (still no schema):** extend the projection to the **whole leaderboard** (official totals +
  live provisional points across all in-play fixtures, with ▲▼ movement) on the leaderboard page —
  the bigger "our standings move live" vision. Per-match version ships the core feeling first.

### 2b. "Wer liegt gerade richtig" highlight — ✅ SHIPPED (folded into 2a)

The 2a projection table is sorted by provisional points and carries the category chips, so the
member currently **Exakt** (or with the right tendency) is visibly on top — no extra data needed.

### 2c. Live reactions on a match

Lightweight emoji reactions on a fixture (😱🔥😂⚽) — collective release without a full chat.

- **Data.** New `reaction` table: `id, tenant_id, fixture_id, user_id, emoji, created_at`,
  unique `(fixture_id, user_id, emoji)` so a tap toggles.
- **RLS.** Enable RLS + restrictive mfa gate. Select: `private.is_member(tenant_id)`. Insert/Delete:
  member AND `user_id = auth.uid()`. Admin may delete any (moderation).
- **Reads/writes.** Server Component reads aggregated counts; a `"use server"` toggle action in
  `src/actions/social.ts` (Zod-validate emoji against an allowlist, re-resolve membership).
- **Refresh.** Poll aggregated reaction counts for the live fixture on a short interval (~10–15 s,
  active tab only). Cheap because it's a tenant-uniform, cacheable count. (Realtime deferred.)
- **Files.** Migration; `src/actions/social.ts`; match page + a `Reactions` component;
  `de.ts` → `reactions`.

---

## Area 3 — After the match: celebrate together, not alone

**Problem.** The exact-hit toast (`src/components/predictions/celebrate-exact-hits.tsx`) is **solo** —
only you see it. That energy is wasted.

### 3a. Group activity feed

A tenant-scoped feed: "🎯 Anna hat 3:1 exakt getippt", "🔥 Tom: 3 Spiele in Folge getroffen",
"😱 Niemand hatte den Sieg von …", "👋 Lisa ist der Gruppe beigetreten". Makes achievements visible
and gives the group something to talk about.

- **Data.** Append-only `activity_event` table: `id, tenant_id, type, actor_id, fixture_id?,
payload jsonb, created_at`. Types: `exact_hit · streak · join · nudge · upset · matchday_winner`.
- **Who writes it.** **Not** end users — written by the **service role / definer** to keep it
  trustworthy, mirroring `admin_audit_log`:
  - `exact_hit`, `upset`, `matchday_winner`: emit from inside `score_fixture()` (the single scoring
    source of truth) so the feed can never disagree with the scoreboard.
  - `join`: from `redeem_invite` / member-add.
  - `nudge`: from the nudge action (Area 1c).
- **RLS.** Enable RLS + mfa gate. Select: `private.is_member(tenant_id)`. **No client INSERT
  policy** (same stance as `prediction` deletes) — writes are definer/service only.
- **Caching.** Tenant-uniform → cacheable, tag `activity:<tenant>`, invalidated on new events (the
  sync job already invalidates tags after scoring).
- **Files.** Migration (table + emit logic in `score_fixture`); `src/lib/data/activity.ts`;
  `src/app/(app)/[tenantId]/` feed component (dashboard sidebar or own tab); `de.ts` → `activity`.
- **Decision.** Derive vs. store? We **store** because streaks/upsets need computation at scoring
  time and a stored feed gives stable ordering + cheap reads. Keep payload small; it's not an audit
  log of every tip (that would be write-heavy and noisy).

### 3b. Matchday recap — ✅ SHIPPED (basics)

A compact dashboard card for the most recently completed matchday: Tagessieger + points + group
Volltreffer count.

- **Data (as built).** `src/lib/data/recap.ts#getMatchdayRecap` — derived from `prediction_score`
  joined to `fixture.matchday/status`, picking the latest finished matchday. Tenant-uniform, cached
  under the leaderboard tags. "Aufsteiger des Tages" (rank movement) and "größter Reinfall" are
  deliberately left out — movement needs the 4c snapshot baseline (a schema change).
- **Files (as built).** `src/lib/data/recap.ts`; a card on the dashboard
  (`src/app/(app)/[tenantId]/page.tsx`); `de.ts` → `dashboard.recap*`.

### 3c. Comments on a match (after kickoff)

Threaded-light comments on a fixture for the banter / rivalry factor: "mutiger Tipp 😅". Only after
kickoff (so they can't leak tendencies) — gate by the same `kickoff_at <= now()` check.

- **Data.** `comment` table: `id, tenant_id, fixture_id, user_id, body, created_at, updated_at`.
- **RLS.** Enable RLS + mfa gate. Select: member AND fixture has kicked off. Insert: member,
  `user_id = auth.uid()`, body length-bounded (also Zod in the action). Update/Delete: own; admin
  delete any (moderation). Reuse the deadline-style `kickoff_at` check via a helper.
- **Refresh.** Poll for new comments on a short interval while the match is live; static after it
  finishes (fetch once). (Realtime deferred.)
- **Files.** Migration; `src/actions/social.ts`; match page `Comments` component; `de.ts` →
  `comments`.

---

## Area 4 — Identity & rivalry (cross-cutting, runs through everything)

**Problem.** Members are initials in a circle and a static rank. No texture, no rivalries.

### 4a. Real avatars

Replace initials with uploaded avatars (Supabase Storage) — used in podium, table, feed, reactions.

- **Data.** `profile.avatar_url` column; a Storage bucket with member-read / owner-write policies.
- **Files.** `src/app/(app)/profile/page.tsx` + upload action; everywhere initials render today.
- **Note.** Managed members (synthetic users) keep initials — they never log in to upload.

### 4b. Streaks / form in the leaderboard — ✅ SHIPPED

A 🔥-streak (current consecutive hits) and last-5 form dots per member.

- **Data (as built).** Computed in `src/lib/data/leaderboard.ts` (`getLeaderboardForm`) — no view
  change, no `db:types` regen. It reads `prediction_score` + each fixture's `kickoff_at` with the
  service role, then the pure helper `src/lib/domain/form.ts#summariseForm` sorts and reduces to
  `{ recent, streak }`. Cached under the **same** `leaderboard` tags, so the sync job / result
  overrides that already invalidate the leaderboard refresh the form in lockstep. "Hit" = category ≠
  `miss`.
- **Files (as built).** `src/lib/domain/form.ts` (+ `form.test.ts` unit tests for ordering / last-5
  window / streak edge cases); `src/lib/data/leaderboard.ts`; the leaderboard page (form dots under
  the name + 🔥 badge when streak ≥ 2); `de.ts` → `leaderboard.{form,formHit,formMiss,streakTitle}`.

### 4c. Momentum (rank-change arrows) + the snapshot question

Show ▲▼ "+2 Plätze seit gestern" instead of a static rank. Also unlocks 3b's "Aufsteiger".

- **Data.** Needs a historical baseline. Cleanest: a `leaderboard_snapshot` table
  (`tenant_id, user_id, rank, total_points, captured_at`) written once per matchday by the **sync
  job** after scoring (it already runs as a separate process and invalidates cache tags).
- **RLS.** Member-read; service-role write.
- **Files.** Migration; emit in `src/lib/sync/run.ts`; `leaderboard.ts`; leaderboard page.

### 4d. Head-to-head duel — ✅ SHIPPED

"Deine Duelle": the viewer's per-match record against every other member — season-long
mini-rivalries.

- **Data (as built).** Pure derived comparison, no new table. The leaderboard page reads all members'
  `prediction_score` via the viewer's cookie client (RLS lets a member read them), then
  `src/lib/domain/head-to-head.ts#computeDuels` tallies wins/losses/draws per opponent over fixtures
  **both** tipped. Per-viewer, so it is NOT cached (computed per request) — distinct from the cached
  tenant-uniform reads.
- **Files (as built).** `src/lib/domain/head-to-head.ts` (+ `head-to-head.test.ts`); a "Deine Duelle"
  section on the leaderboard page (ordered by opponent rank; wins green when ahead, losses red when
  behind); `de.ts` → `leaderboard.duels*`.

---

## Suggested phasing

Ordered by **value-to-effort**, each phase shippable on its own.

| Phase                                              | Ships                                                              | Why first                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1 — Anticipation + quick identity** ✅ SHIPPED  | 1a tip-pulse, 1b group pace, 4b streaks/form                       | All derived or count-only; no Realtime; immediate "we" signal for low cost.                                                                    |
| **P2 — The feed** (3b ✅; 3a needs schema)         | 3a activity feed (emit from `score_fixture`), 3b matchday recap ✅ | The social backbone; turns solo exact-hit toast into shared moments. Reuses existing cache-tag invalidation.                                   |
| **P3 — Live fiebern** ✅ SHIPPED                   | 2a live projected table ✅, 2b "wer liegt richtig" ✅              | The emotional centrepiece. Client polling (~45 s, active tab only). Per-match shipped; full-leaderboard projection is the no-schema follow-up. |
| **P4 — Banter**                                    | 2c reactions, 3c comments, 1c in-app nudge                         | Interaction layer; client polling (~10–15 s while live); needs light moderation (admin delete).                                                |
| **P5 — Rivalry polish** (4d ✅; 4a/4c need schema) | 4a avatars, 4c momentum + snapshots, 4d head-to-head ✅            | Depth that pays off over a full tournament; 4c needs the snapshot job.                                                                         |

## Cross-cutting technical notes

- **Client-side polling is the chosen transport** (decided). Supabase Realtime is **deferred** — its
  per-message fan-out makes the free-tier budget unpredictable once there are several groups (see the
  budget analysis below). Every "live" surface here therefore refreshes by polling from the client.
  Realtime stays a clean future upgrade because nothing in the data model depends on the transport.

### Polling design (the chosen transport)

- **Reuse the existing pattern.** The leaderboard page already lists in-play matches and re-renders on
  a 60 s interval — extend that, don't invent a new mechanism.
- **Poll only what's live, only while the tab is active.** Poll the live match / its projection /
  reactions / comments **only** when a fixture is `live` and `document.visibilityState === "visible"`;
  pause on hidden tab. No live fixture → no polling.
- **Tiered intervals.** Score + live projection ~30–60 s (the sync job is the upstream bottleneck
  anyway, so faster buys nothing). Reactions/comments ~10–15 s while a match is live. Tune later.
- **Cheap, cacheable endpoints.** Polls hit tenant-uniform reads (tip-pulse, live projection, feed)
  that are cacheable with short TTLs + tag invalidation — so N members polling collapse to ~one DB
  read per interval, not N. Per-user reads stay uncached (see the caching rule above).
- **Conditional fetches.** Return a cheap version/etag (e.g. `max(updated_at)` or a score hash) so an
  unchanged poll is a no-op round-trip, not a re-render.

### Why Realtime is deferred (the free-tier budget)

Free-plan limits (verified June 2026): **200** concurrent peak connections · **2,000,000**
messages/month · 100 msg/s · 256 KB broadcast payload. The killer is **fan-out**: one DB change
delivered to N subscribers counts as N messages.

- One ~15-person group, live match: ~2,000 messages/match → ~208k/month ≈ 10 % of budget. Fine.
- One very active 50-person group: ~14,500 messages/match ≈ 1.5 M/month — already near the 2 M cap
  with a **single** group. **Several groups blow past it**, and the 200-connection ceiling (open tabs
  at an evening match) is reached even sooner. This is exactly why we poll instead.

If Realtime is ever revisited (paid plan, or proven small scale): prefer **Broadcast over Postgres
Changes** for reaction fan-out, **one channel per fixture**, debounce, and subscribe only on an active
tab. The polling endpoints above already encapsulate the data, so swapping the transport is local.

**Unrelated free-tier gotcha (still relevant — it's about the DB, not Realtime):** a free project is
**paused after 1 week of inactivity**. A non-issue during the WC (near-daily matches) and the **cron
sync job keeps the project warm** anyway — but in long pre/post gaps some request must hit it.

- **Caching discipline.** Tenant-uniform reads (tip-pulse, activity feed, recap, leaderboard) may be
  cached with tags + invalidation. The **live projection and anything per-user must not be cached** —
  the cache key has no user/score in it and would leak or go stale. (See `docs/caching.md`.)
- **New tables checklist.** For each of `reaction`, `comment`, `activity_event`,
  `leaderboard_snapshot` (and any nudge table): `enable row level security`; a permissive member
  SELECT + scoped write policies; the restrictive `*_require_mfa` gate; appropriate indexes
  (`(tenant_id, fixture_id)`, `(tenant_id, created_at desc)`); then `pnpm db:types` + `pnpm typecheck`.
- **Trust boundary.** All user-generated writes (reactions, comments, nudges) go through
  `src/actions/social.ts` — Zod-validate, re-resolve membership/role, never trust the form. Feed
  events are definer/service-only.
- **Scoring stays authoritative.** The live projection uses `engine.ts` (the mirror) for _display
  only_; the stored `prediction_score` from `score_fixture` remains the single source of truth. They
  must agree at full time — same rules (90-minute result for knockouts, advancing-team bonus).
- **i18n.** Every new string in `de.ts` under new top-level keys; regenerate `public/offline.html`
  via `pnpm tsx scripts/generate-pwa-assets.ts` only if offline copy changes.
- **Definition of done (per the project rule).** Each phase finishes with `pnpm lint`,
  `pnpm format`, `pnpm test` (integration tests asserting the new RLS: non-members can't read a
  tenant's feed/reactions/comments; pre-kickoff secrecy survives the tip-pulse count).

## Open questions for the next step

1. **Feed placement** — dashboard sidebar, a dedicated tab, or both?
2. **Nudge** — own table or just an activity-event type? (Lean: event type.)
3. **Reactions/comments scope** — per fixture only, or also reactions on a _member's tip_?
4. **Moderation** — is admin-delete enough, or do we need a report/hide flow?

_(Resolved: **client-side polling** is the chosen transport. Supabase Realtime is deferred — its
per-message fan-out makes the free-tier budget unpredictable across several groups. See "Polling
design" and "Why Realtime is deferred" above.)_
