-- Web Push notifications for installed PWAs.
--
-- Two use cases, both server-driven from the existing sync cron:
--   * a tip reminder ~1h before kickoff when a member has not tipped yet, and
--   * a result push (incl. the member's own points) once a fixture is finished.
--
-- This migration adds the storage. The send itself happens app-side in
-- src/lib/notifications/dispatch.ts (service role), gated by a delivery ledger so
-- the 120s cron cadence cannot re-send.

-- ---------------------------------------------------------------------------
-- 1. Browser push subscriptions — account-wide (not tenant-scoped). One row per
-- installed device/endpoint. The user manages their own; the service role reads
-- all of them to send. Personal table → it also gets the restrictive aal2 gate.
-- ---------------------------------------------------------------------------

create table public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The push service endpoint is globally unique per subscription; it is the
  -- natural conflict key when a device re-subscribes.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscription_user_idx on public.push_subscription (user_id);

alter table public.push_subscription enable row level security;

create policy push_subscription_select on public.push_subscription
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscription_insert on public.push_subscription
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_subscription_update on public.push_subscription
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_subscription_delete on public.push_subscription
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscription_require_mfa on public.push_subscription
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- ---------------------------------------------------------------------------
-- 2. Delivery ledger — idempotency for the dispatcher. A notification is
-- per (tenant, user, fixture, kind): a member may have tipped in one group but
-- not another, and points differ per group. The unique constraint makes the
-- dispatcher's "send once" a single insert-or-skip. Service-role only: RLS is
-- enabled with no authenticated policy, so it is locked to the anon/auth keys
-- (the service role bypasses RLS), mirroring how prediction_score is written.
-- ---------------------------------------------------------------------------

create type notification_kind as enum ('tip_reminder', 'result');

create table public.notification_delivery (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  fixture_id uuid not null references public.fixture (id) on delete cascade,
  kind public.notification_kind not null,
  sent_at timestamptz not null default now(),
  unique (tenant_id, user_id, fixture_id, kind)
);

create index notification_delivery_fixture_idx
  on public.notification_delivery (fixture_id, kind);

alter table public.notification_delivery enable row level security;
-- No policy on purpose: locked to authenticated/anon, written only by the
-- service-role dispatcher (which bypasses RLS).
