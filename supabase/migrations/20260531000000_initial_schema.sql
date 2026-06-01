-- Initial schema for the Tippspiel: event spine, multi-tenancy, predictions,
-- scoring, the site-admin layer and account deletion — the full launch state in
-- one migration.
--
-- Naming: the tenant (a closed player group) is `tenant` internally; the German
-- UI labels it "Gruppe". Every externally-synced entity carries (provider,
-- external_id) so re-syncs are idempotent and the data source is swappable.
--
-- Layered authorization (defence in depth): SECURITY DEFINER helpers in a
-- non-exposed `private` schema back the RLS policies, which are the final,
-- non-bypassable gate. Server Actions re-check on top; RLS still holds if they
-- are bypassed.

-- ===========================================================================
-- SECTION 1 — Enums
-- ===========================================================================

create type stage_kind as enum (
  'group',
  'last_32',
  'last_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
  'matchday',
  'other'
);

create type fixture_status as enum (
  'scheduled',
  'live',
  'finished',
  'postponed',
  'abandoned',
  'cancelled'
);

create type member_role as enum ('admin', 'member');

-- How a single prediction matched the regulation (90') result.
create type score_category as enum ('exact', 'goal_diff', 'tendency', 'miss');

create type audit_action as enum (
  'tenant_create',
  'member_add',
  'member_remove',
  'role_change',
  'ruleset_change',
  'result_override',
  'invite_create',
  'invite_redeem'
);

-- ===========================================================================
-- SECTION 2 — Tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Event spine: sport -> competition -> season -> stage -> fixture, plus team
-- ---------------------------------------------------------------------------

create table public.sport (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null
);

create table public.competition (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sport (id),
  name text not null,
  provider text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.season (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competition (id) on delete cascade,
  label text not null,
  starts_on date,
  ends_on date,
  provider text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.stage (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season (id) on delete cascade,
  kind stage_kind not null,
  name text not null,
  ordinal smallint not null,
  unique (season_id, ordinal)
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  country_code text,
  crest_url text,
  provider text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

-- A single match. Scores are split so a knockout match decided in extra time or
-- on penalties can still be scored against the 90' (regulation) result, while
-- winner_team_id captures who actually advanced.
create table public.fixture (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.season (id) on delete cascade,
  stage_id uuid references public.stage (id) on delete set null,
  matchday smallint,
  home_team_id uuid references public.team (id),
  away_team_id uuid references public.team (id),
  kickoff_at timestamptz not null,
  status fixture_status not null default 'scheduled',
  -- Regulation (90') result — the basis for score predictions.
  regular_home smallint,
  regular_away smallint,
  -- Knockout extras.
  after_extra_time boolean not null default false,
  penalty_home smallint,
  penalty_away smallint,
  winner_team_id uuid references public.team (id),
  provider text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id),
  -- Knockout fixtures may have both teams unknown (NULL) until pairings are set;
  -- only reject two identical, known teams.
  constraint fixture_distinct_teams check (
    home_team_id is null or away_team_id is null or home_team_id <> away_team_id
  )
);

create index fixture_season_kickoff_idx on public.fixture (season_id, kickoff_at);
create index fixture_status_idx on public.fixture (status);
create index fixture_kickoff_idx on public.fixture (kickoff_at);

-- ---------------------------------------------------------------------------
-- Profiles (public, non-sensitive identity shown on leaderboards)
-- ---------------------------------------------------------------------------

create table public.profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_display_name_len check (char_length(display_name) between 1 and 60)
);

-- ---------------------------------------------------------------------------
-- Tenancy: tenant ("Gruppe") + membership + season subscription + invites
-- ---------------------------------------------------------------------------

create table public.tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  -- When false, members are view-only: the prediction write policies block
  -- their own writes while an admin may still write for any member.
  member_tipping_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint tenant_name_len check (char_length(name) between 2 and 80)
);

create table public.tenant_member (
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Policy-referenced columns get explicit indexes (see RLS rationale below).
create index tenant_member_user_idx on public.tenant_member (user_id);
create index tenant_member_tenant_role_idx on public.tenant_member (tenant_id, role);

create table public.tenant_season (
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  season_id uuid not null references public.season (id) on delete cascade,
  primary key (tenant_id, season_id)
);

create table public.tenant_invite (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  code text not null unique,
  role member_role not null default 'member',
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tenant_invite_max_uses_positive check (max_uses is null or max_uses > 0)
);

create index tenant_invite_tenant_idx on public.tenant_invite (tenant_id);

-- ---------------------------------------------------------------------------
-- Scoring rule sets (per tenant, versioned JSONB so rules stay flexible)
-- ---------------------------------------------------------------------------

create table public.scoring_rule_set (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  version integer not null,
  config jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, version)
);

-- At most one active rule set per tenant.
create unique index scoring_rule_set_one_active_idx
  on public.scoring_rule_set (tenant_id)
  where is_active;

-- ---------------------------------------------------------------------------
-- Predictions + computed scores
-- ---------------------------------------------------------------------------

create table public.prediction (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  fixture_id uuid not null references public.fixture (id) on delete cascade,
  home_goals smallint not null,
  away_goals smallint not null,
  advancing_team_id uuid references public.team (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, fixture_id),
  constraint prediction_goals_nonneg check (home_goals >= 0 and away_goals >= 0),
  constraint prediction_goals_sane check (home_goals <= 99 and away_goals <= 99)
);

create index prediction_tenant_idx on public.prediction (tenant_id);
create index prediction_user_idx on public.prediction (user_id);
create index prediction_fixture_idx on public.prediction (fixture_id);
create index prediction_tenant_user_idx on public.prediction (tenant_id, user_id);

-- One current score per prediction. tenant_id/user_id are denormalised so RLS
-- and leaderboard aggregation never need to join `prediction`.
create table public.prediction_score (
  prediction_id uuid primary key references public.prediction (id) on delete cascade,
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  fixture_id uuid not null references public.fixture (id) on delete cascade,
  rule_set_id uuid not null references public.scoring_rule_set (id) on delete cascade,
  points integer not null,
  category score_category not null,
  computed_at timestamptz not null default now()
);

create index prediction_score_tenant_user_idx on public.prediction_score (tenant_id, user_id);
create index prediction_score_fixture_idx on public.prediction_score (fixture_id);

-- ---------------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------------

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action audit_action not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_tenant_idx on public.admin_audit_log (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Site admins (operators of the whole install) + global app settings
-- ---------------------------------------------------------------------------

create table public.site_admin (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.app_setting (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed the two launch toggles, both on by default.
insert into public.app_setting (key, value) values
  ('registration_enabled', '{"enabled": true}'::jsonb),
  ('group_creation_enabled', '{"enabled": true}'::jsonb);

-- ===========================================================================
-- SECTION 3 — Authorization helpers (private schema)
-- ===========================================================================
--
-- These live in a NON-exposed `private` schema and are SECURITY DEFINER +
-- LANGUAGE plpgsql. plpgsql matters: a LANGUAGE sql helper would be inlined at
-- plan time, dropping the definer context and reintroducing "infinite recursion
-- detected in policy" on tenant_member.

create schema if not exists private;

-- Only authenticated users may call the helpers; anon must never reach them.
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- True if the current user is a member of the given tenant.
create or replace function private.is_member(p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.tenant_member tm
    where tm.tenant_id = p_tenant
      and tm.user_id = (select auth.uid())
  );
end;
$$;

-- True if the current user is an admin of the given tenant.
create or replace function private.is_admin(p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.tenant_member tm
    where tm.tenant_id = p_tenant
      and tm.user_id = (select auth.uid())
      and tm.role = 'admin'
  );
end;
$$;

-- True if p_user is a member of p_tenant (not necessarily the current user).
-- Used by the prediction write policies so an admin can write for any member.
create or replace function private.is_member_of(p_tenant uuid, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.tenant_member tm
    where tm.tenant_id = p_tenant and tm.user_id = p_user
  );
end;
$$;

-- True if the current user shares at least one tenant with p_user (used to gate
-- profile visibility to co-members only).
create or replace function private.shares_tenant(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.tenant_member me
    join public.tenant_member other on other.tenant_id = me.tenant_id
    where me.user_id = (select auth.uid())
      and other.user_id = p_user
  );
end;
$$;

-- True if the fixture belongs to a season the tenant is subscribed to. Prevents
-- members from predicting fixtures of competitions their group does not play.
create or replace function private.fixture_in_tenant(p_tenant uuid, p_fixture uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.fixture f
    join public.tenant_season ts on ts.season_id = f.season_id
    where f.id = p_fixture
      and ts.tenant_id = p_tenant
  );
end;
$$;

-- Whether members of p_tenant may submit their own predictions.
create or replace function private.member_tipping_enabled(p_tenant uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(
    (select t.member_tipping_enabled from public.tenant t where t.id = p_tenant),
    true
  );
end;
$$;

-- True if the current user is a site admin. SECURITY DEFINER + plpgsql for the
-- same reason as the tenant helpers: it must read site_admin under definer
-- rights (RLS on site_admin is otherwise locked) and must not be inlined.
create or replace function private.is_site_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.site_admin sa
    where sa.user_id = (select auth.uid())
  );
end;
$$;

revoke all on function
  private.is_member(uuid),
  private.is_admin(uuid),
  private.is_member_of(uuid, uuid),
  private.shares_tenant(uuid),
  private.fixture_in_tenant(uuid, uuid),
  private.member_tipping_enabled(uuid),
  private.is_site_admin()
from public, anon;

grant execute on function
  private.is_member(uuid),
  private.is_admin(uuid),
  private.is_member_of(uuid, uuid),
  private.shares_tenant(uuid),
  private.fixture_in_tenant(uuid, uuid),
  private.member_tipping_enabled(uuid),
  private.is_site_admin()
to authenticated;

-- ===========================================================================
-- SECTION 4 — Integrity triggers
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger fixture_set_updated_at
  before update on public.fixture
  for each row execute function public.set_updated_at();

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

create trigger prediction_set_updated_at
  before update on public.prediction
  for each row execute function public.set_updated_at();

create trigger app_setting_set_updated_at
  before update on public.app_setting
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Deadline lock: predictions cannot be created or changed at/after kickoff.
-- Uses the DB clock (immune to client tampering) and fires for every writer.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kickoff timestamptz;
begin
  select f.kickoff_at into v_kickoff
  from public.fixture f
  where f.id = new.fixture_id;

  if v_kickoff is null then
    raise exception 'Spiel % existiert nicht', new.fixture_id
      using errcode = 'foreign_key_violation';
  end if;

  if now() >= v_kickoff then
    raise exception 'Tipp-Deadline überschritten: Anpfiff war %', v_kickoff
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger prediction_enforce_deadline
  before insert or update on public.prediction
  for each row execute function public.enforce_prediction_deadline();

-- ---------------------------------------------------------------------------
-- Every tenant must keep at least one admin.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_min_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := coalesce(old.tenant_id, new.tenant_id);
  v_admins integer;
begin
  -- Skip when the tenant itself is being deleted (its members cascade away);
  -- the invariant only matters while the tenant still exists.
  if not exists (select 1 from public.tenant t where t.id = v_tenant) then
    return null;
  end if;

  select count(*) into v_admins
  from public.tenant_member tm
  where tm.tenant_id = v_tenant
    and tm.role = 'admin';

  if v_admins = 0 then
    raise exception 'Eine Gruppe muss mindestens einen Admin behalten'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create trigger tenant_member_min_one_admin
  after update or delete on public.tenant_member
  for each row execute function public.enforce_min_one_admin();

-- ---------------------------------------------------------------------------
-- Provision a profile row whenever an auth user is created.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep trigger functions off the PostgREST RPC surface.
--
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which lets PostgREST
-- expose these as /rest/v1/rpc/<name> to the anon/authenticated roles. They are
-- only ever meant to fire as triggers, and EXECUTE on a trigger function is
-- checked at CREATE TRIGGER time, not when the trigger fires — so revoking it
-- does NOT break the triggers, it just removes them from the callable API
-- (clearing the anon_/authenticated_security_definer_function_executable lints).
-- The three SECURITY DEFINER ones would otherwise run with owner rights and
-- bypass RLS; set_updated_at is INVOKER but equally has no business as an RPC.
revoke all on function public.enforce_prediction_deadline() from public, anon, authenticated;
revoke all on function public.enforce_min_one_admin() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ===========================================================================
-- SECTION 5 — Row Level Security
-- ===========================================================================
--
-- Conventions:
--  * RLS is enabled on every table. RLS-on + no policy = locked;
--    RLS-off would be wide open to the anon key — so nothing is left un-enabled.
--  * Helpers and auth.uid() are wrapped in (select ...) so Postgres evaluates
--    them once per statement (initPlan) instead of once per row.
--  * Every policy is scoped `to authenticated`; anon matches no policy and is
--    therefore denied. Writes with no policy fall through to service_role only.

-- ---------------------------------------------------------------------------
-- Event spine: readable by any signed-in user, written only by service_role
-- (the sync job) which bypasses RLS. No write policies are defined on purpose.
-- ---------------------------------------------------------------------------

alter table public.sport enable row level security;
alter table public.competition enable row level security;
alter table public.season enable row level security;
alter table public.stage enable row level security;
alter table public.team enable row level security;
alter table public.fixture enable row level security;

create policy sport_read on public.sport
  for select to authenticated using (true);
create policy competition_read on public.competition
  for select to authenticated using (true);
create policy season_read on public.season
  for select to authenticated using (true);
create policy stage_read on public.stage
  for select to authenticated using (true);
create policy team_read on public.team
  for select to authenticated using (true);
create policy fixture_read on public.fixture
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Profiles: own profile always; co-members' profiles for leaderboards.
-- ---------------------------------------------------------------------------

alter table public.profile enable row level security;

create policy profile_select on public.profile
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.shares_tenant(user_id))
  );

create policy profile_insert on public.profile
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy profile_update on public.profile
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Tenant: members read; admins rename/delete. Creation is via create_group().
-- ---------------------------------------------------------------------------

alter table public.tenant enable row level security;

create policy tenant_select on public.tenant
  for select to authenticated
  using ((select private.is_member(id)));

create policy tenant_update on public.tenant
  for update to authenticated
  using ((select private.is_admin(id)))
  with check ((select private.is_admin(id)));

create policy tenant_delete on public.tenant
  for delete to authenticated
  using ((select private.is_admin(id)));

-- ---------------------------------------------------------------------------
-- Membership: members see the roster; admins manage it; anyone can leave.
-- ---------------------------------------------------------------------------

alter table public.tenant_member enable row level security;

create policy tenant_member_select on public.tenant_member
  for select to authenticated
  using ((select private.is_member(tenant_id)));

create policy tenant_member_insert on public.tenant_member
  for insert to authenticated
  with check ((select private.is_admin(tenant_id)));

create policy tenant_member_update on public.tenant_member
  for update to authenticated
  using ((select private.is_admin(tenant_id)))
  with check ((select private.is_admin(tenant_id)));

create policy tenant_member_delete on public.tenant_member
  for delete to authenticated
  using (
    (select private.is_admin(tenant_id))
    or user_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Season subscriptions: members read; admins manage.
-- ---------------------------------------------------------------------------

alter table public.tenant_season enable row level security;

create policy tenant_season_select on public.tenant_season
  for select to authenticated
  using ((select private.is_member(tenant_id)));

create policy tenant_season_insert on public.tenant_season
  for insert to authenticated
  with check ((select private.is_admin(tenant_id)));

create policy tenant_season_delete on public.tenant_season
  for delete to authenticated
  using ((select private.is_admin(tenant_id)));

-- ---------------------------------------------------------------------------
-- Invites: admin-only. Redemption happens through redeem_invite() (definer).
-- ---------------------------------------------------------------------------

alter table public.tenant_invite enable row level security;

create policy tenant_invite_select on public.tenant_invite
  for select to authenticated
  using ((select private.is_admin(tenant_id)));

create policy tenant_invite_insert on public.tenant_invite
  for insert to authenticated
  with check ((select private.is_admin(tenant_id)));

create policy tenant_invite_update on public.tenant_invite
  for update to authenticated
  using ((select private.is_admin(tenant_id)))
  with check ((select private.is_admin(tenant_id)));

create policy tenant_invite_delete on public.tenant_invite
  for delete to authenticated
  using ((select private.is_admin(tenant_id)));

-- ---------------------------------------------------------------------------
-- Scoring rule sets: members read the rules; admins edit them.
-- ---------------------------------------------------------------------------

alter table public.scoring_rule_set enable row level security;

create policy scoring_rule_set_select on public.scoring_rule_set
  for select to authenticated
  using ((select private.is_member(tenant_id)));

create policy scoring_rule_set_insert on public.scoring_rule_set
  for insert to authenticated
  with check ((select private.is_admin(tenant_id)));

create policy scoring_rule_set_update on public.scoring_rule_set
  for update to authenticated
  using ((select private.is_admin(tenant_id)))
  with check ((select private.is_admin(tenant_id)));

create policy scoring_rule_set_delete on public.scoring_rule_set
  for delete to authenticated
  using ((select private.is_admin(tenant_id)));

-- ---------------------------------------------------------------------------
-- Predictions: own always; admins always; co-members only after kickoff.
-- The TIME gate on writes is the enforce_prediction_deadline() trigger; RLS
-- owns the WHO gate. An admin may write for any member of the tenant; a member
-- may write only their own, and only while member tipping is enabled. There is
-- intentionally no DELETE policy (deletes are service-role only).
-- ---------------------------------------------------------------------------

alter table public.prediction enable row level security;

create policy prediction_select on public.prediction
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin(tenant_id))
    or (
      (select private.is_member(tenant_id))
      and exists (
        select 1
        from public.fixture f
        where f.id = prediction.fixture_id
          and f.kickoff_at <= now()
      )
    )
  );

create policy prediction_insert on public.prediction
  for insert to authenticated
  with check (
    (select private.fixture_in_tenant(tenant_id, fixture_id))
    and (
      (
        (select private.is_admin(tenant_id))
        and (select private.is_member_of(tenant_id, user_id))
      )
      or (
        user_id = (select auth.uid())
        and (select private.is_member(tenant_id))
        and (select private.member_tipping_enabled(tenant_id))
      )
    )
  );

create policy prediction_update on public.prediction
  for update to authenticated
  using (
    (select private.is_admin(tenant_id))
    or (
      user_id = (select auth.uid())
      and (select private.member_tipping_enabled(tenant_id))
    )
  )
  with check (
    (select private.fixture_in_tenant(tenant_id, fixture_id))
    and (
      (
        (select private.is_admin(tenant_id))
        and (select private.is_member_of(tenant_id, user_id))
      )
      or (
        user_id = (select auth.uid())
        and (select private.is_member(tenant_id))
        and (select private.member_tipping_enabled(tenant_id))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Computed scores: members read; only service_role / definer functions write.
-- ---------------------------------------------------------------------------

alter table public.prediction_score enable row level security;

create policy prediction_score_select on public.prediction_score
  for select to authenticated
  using ((select private.is_member(tenant_id)));

-- ---------------------------------------------------------------------------
-- Audit log: admins read and append their own actions.
-- ---------------------------------------------------------------------------

alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select on public.admin_audit_log
  for select to authenticated
  using ((select private.is_admin(tenant_id)));

create policy admin_audit_log_insert on public.admin_audit_log
  for insert to authenticated
  with check (
    (select private.is_admin(tenant_id))
    and actor_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Site admins: a user may see only their own row (enough to learn "am I a site
-- admin?"). No write policies: membership is granted out-of-band via the
-- service role (scripts/set-site-admin.ts), never self-service.
-- ---------------------------------------------------------------------------

alter table public.site_admin enable row level security;

create policy site_admin_select_self on public.site_admin
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- App settings: only the known public toggles are anon-readable (the register
-- page needs registration_enabled pre-session). Future keys are private by
-- default. Authenticated users may read everything; writes are site-admin only.
-- ---------------------------------------------------------------------------

alter table public.app_setting enable row level security;

create policy app_setting_select_public on public.app_setting
  for select to anon
  using (key in ('registration_enabled', 'group_creation_enabled'));

create policy app_setting_select_authed on public.app_setting
  for select to authenticated
  using (true);

create policy app_setting_update on public.app_setting
  for update to authenticated
  using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));

-- ===========================================================================
-- SECTION 6 — Scoring engine, RPCs and the leaderboard view
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Scoring engine (server-authoritative, configurable, pure)
-- ---------------------------------------------------------------------------

-- Result of scoring one prediction against a regulation result.
create type public.score_outcome as (points integer, category public.score_category);

-- Pure function: given a prediction, the regulation (90') result, the stage and
-- a rule-set config, return points + how it matched. Mirrored 1:1 in TypeScript
-- (src/lib/scoring) for unit tests and the in-form "you'd get N points" preview.
-- Knockout matches are scored on the regulation result; the advancing-team
-- bonus uses the actual winner (post extra-time/penalties).
create or replace function public.score_prediction(
  p_home integer,
  p_away integer,
  p_advancing uuid,
  f_home integer,
  f_away integer,
  f_winner uuid,
  p_stage public.stage_kind,
  p_config jsonb
)
returns public.score_outcome
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_pdiff integer;
  v_fdiff integer;
  v_base integer;
  v_cat public.score_category;
  v_mult numeric;
  v_points integer;
begin
  if p_home is null or p_away is null or f_home is null or f_away is null then
    return (0, 'miss')::public.score_outcome;
  end if;

  v_pdiff := p_home - p_away;
  v_fdiff := f_home - f_away;

  if p_home = f_home and p_away = f_away then
    v_cat := 'exact';
    v_base := coalesce((p_config ->> 'exact')::integer, 0);
  elsif v_pdiff = v_fdiff then
    v_cat := 'goal_diff';
    v_base := coalesce((p_config ->> 'goal_diff')::integer, 0);
  elsif sign(v_pdiff) = sign(v_fdiff) then
    v_cat := 'tendency';
    v_base := coalesce((p_config ->> 'tendency')::integer, 0);
  else
    v_cat := 'miss';
    v_base := 0;
  end if;

  v_mult := coalesce((p_config -> 'stage_multipliers' ->> p_stage::text)::numeric, 1);
  v_points := floor(v_base * v_mult)::integer;

  -- Advancing-team bonus (knockout only): predicted advancing team == winner.
  if p_advancing is not null and f_winner is not null and p_advancing = f_winner then
    v_points := v_points + coalesce((p_config ->> 'advance_bonus')::integer, 0);
  end if;

  return (v_points, v_cat)::public.score_outcome;
end;
$$;

revoke all on function
  public.score_prediction(integer, integer, uuid, integer, integer, uuid, public.stage_kind, jsonb)
from public;
grant execute on function
  public.score_prediction(integer, integer, uuid, integer, integer, uuid, public.stage_kind, jsonb)
to authenticated, service_role;

-- Recompute and persist scores for every prediction on a fixture, each against
-- its own tenant's active rule set. Idempotent: re-running after a corrected
-- result simply overwrites. A non-finished / result-less fixture clears scores
-- (postponed/abandoned excluded, not zeroed). SECURITY DEFINER + service_role
-- only — the client can never influence points.
create or replace function public.score_fixture(p_fixture uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixture;
  v_stage public.stage_kind;
  v_rule public.scoring_rule_set;
  v_pred public.prediction;
  v_outcome public.score_outcome;
begin
  select * into v_fixture from public.fixture where id = p_fixture;
  if not found then
    raise exception 'Spiel % nicht gefunden', p_fixture using errcode = 'no_data_found';
  end if;

  if v_fixture.status <> 'finished'
     or v_fixture.regular_home is null
     or v_fixture.regular_away is null then
    delete from public.prediction_score where fixture_id = p_fixture;
    return;
  end if;

  select coalesce(s.kind, 'other')
    into v_stage
  from public.fixture f
  left join public.stage s on s.id = f.stage_id
  where f.id = p_fixture;

  for v_pred in
    select * from public.prediction where fixture_id = p_fixture
  loop
    select * into v_rule
    from public.scoring_rule_set
    where tenant_id = v_pred.tenant_id and is_active
    limit 1;

    if not found then
      delete from public.prediction_score where prediction_id = v_pred.id;
      continue;
    end if;

    v_outcome := public.score_prediction(
      v_pred.home_goals, v_pred.away_goals, v_pred.advancing_team_id,
      v_fixture.regular_home, v_fixture.regular_away, v_fixture.winner_team_id,
      v_stage, v_rule.config
    );

    insert into public.prediction_score
      (prediction_id, tenant_id, user_id, fixture_id, rule_set_id, points, category, computed_at)
    values
      (v_pred.id, v_pred.tenant_id, v_pred.user_id, p_fixture, v_rule.id,
       v_outcome.points, v_outcome.category, now())
    on conflict (prediction_id) do update set
      rule_set_id = excluded.rule_set_id,
      points = excluded.points,
      category = excluded.category,
      computed_at = excluded.computed_at;
  end loop;
end;
$$;

revoke all on function public.score_fixture(uuid) from public, anon, authenticated;
grant execute on function public.score_fixture(uuid) to service_role;

-- Admin-triggered full recompute for a tenant (e.g. after a rule change).
-- SECURITY DEFINER so it may call score_fixture; re-checks admin via auth.uid().
create or replace function public.recompute_tenant(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture_id uuid;
begin
  if not private.is_admin(p_tenant) then
    raise exception 'Nur Admins dürfen Punkte neu berechnen'
      using errcode = 'insufficient_privilege';
  end if;

  for v_fixture_id in
    select f.id
    from public.fixture f
    join public.tenant_season ts on ts.season_id = f.season_id
    where ts.tenant_id = p_tenant and f.status = 'finished'
  loop
    perform public.score_fixture(v_fixture_id);
  end loop;

  insert into public.admin_audit_log (tenant_id, actor_id, action)
  values (p_tenant, (select auth.uid()), 'ruleset_change');
end;
$$;

revoke all on function public.recompute_tenant(uuid) from public, anon;
grant execute on function public.recompute_tenant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tenant lifecycle RPCs (definer: solve the membership chicken-and-egg)
-- ---------------------------------------------------------------------------

-- Create a tenant, make the caller its admin, seed the default rule set
-- (tendency 1 / goal_diff 2 / exact 3, knockout advance_bonus 2) and subscribe
-- it to every seeded season (v1: only WC2026 exists). group_creation_enabled is
-- a hard gate re-checked here under definer rights; site admins always bypass.
create or replace function public.create_group(p_name text)
returns public.tenant
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant public.tenant;
  v_creation_enabled boolean;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = 'insufficient_privilege';
  end if;

  if not private.is_site_admin() then
    select coalesce((value ->> 'enabled')::boolean, true)
      into v_creation_enabled
      from public.app_setting
      where key = 'group_creation_enabled';
    if v_creation_enabled is not null and not v_creation_enabled then
      raise exception 'Gruppen-Erstellung ist deaktiviert'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into public.tenant (name, created_by)
  values (p_name, v_uid)
  returning * into v_tenant;

  insert into public.tenant_member (tenant_id, user_id, role)
  values (v_tenant.id, v_uid, 'admin');

  insert into public.scoring_rule_set (tenant_id, version, config, is_active)
  values (
    v_tenant.id,
    1,
    '{"exact": 3, "goal_diff": 2, "tendency": 1, "advance_bonus": 2, "stage_multipliers": {}}'::jsonb,
    true
  );

  insert into public.tenant_season (tenant_id, season_id)
  select v_tenant.id, s.id from public.season s;

  insert into public.admin_audit_log (tenant_id, actor_id, action, target_type, target_id)
  values (v_tenant.id, v_uid, 'tenant_create', 'tenant', v_tenant.id::text);

  return v_tenant;
end;
$$;

revoke all on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;

-- Redeem an invite code: validate, add the caller as a member, count the use.
create or replace function public.redeem_invite(p_code text)
returns public.tenant
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.tenant_invite;
  v_tenant public.tenant;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.tenant_invite where code = p_code;
  if not found then
    raise exception 'Ungültiger Einladungscode' using errcode = 'no_data_found';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Einladungscode ist abgelaufen' using errcode = 'check_violation';
  end if;
  if v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    raise exception 'Einladungscode ist aufgebraucht' using errcode = 'check_violation';
  end if;

  insert into public.tenant_member (tenant_id, user_id, role)
  values (v_invite.tenant_id, v_uid, v_invite.role)
  on conflict (tenant_id, user_id) do nothing;

  -- Only count a use when a membership was actually created.
  if found then
    update public.tenant_invite set used_count = used_count + 1 where id = v_invite.id;
    insert into public.admin_audit_log (tenant_id, actor_id, action, target_type, target_id)
    values (v_invite.tenant_id, v_uid, 'invite_redeem', 'user', v_uid::text);
  end if;

  select * into v_tenant from public.tenant where id = v_invite.tenant_id;
  return v_tenant;
end;
$$;

revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- Delete the calling user's own account atomically. Blocks deletion when the
-- caller is the sole admin of a group that still has other members (they must
-- promote someone first); deletes groups where the caller is the only member
-- (the min-one-admin trigger skips while the tenant itself is removed); then
-- removes the auth user, whose FKs cascade profile/memberships/predictions.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant_id uuid;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = 'insufficient_privilege';
  end if;

  -- Refuse if the caller is the only admin of a group with other members.
  for v_tenant_id in
    select tm.tenant_id from public.tenant_member tm
    where tm.user_id = v_uid and tm.role = 'admin'
  loop
    if (select count(*) from public.tenant_member where tenant_id = v_tenant_id and role = 'admin') = 1
       and (select count(*) from public.tenant_member where tenant_id = v_tenant_id) > 1 then
      raise exception 'SOLE_ADMIN' using errcode = 'check_violation';
    end if;
  end loop;

  -- Remove groups where the caller is the only member.
  delete from public.tenant t
  where exists (
      select 1 from public.tenant_member tm where tm.tenant_id = t.id and tm.user_id = v_uid
    )
    and (select count(*) from public.tenant_member tm2 where tm2.tenant_id = t.id) = 1;

  -- Remove the auth user; everything else cascades via FK.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard (security_invoker: the caller's RLS decides what they can see)
-- ---------------------------------------------------------------------------

create view public.leaderboard
with (security_invoker = true) as
select
  ps.tenant_id,
  ps.user_id,
  pr_profile.display_name,
  sum(ps.points)::integer as total_points,
  count(*) filter (where ps.category = 'exact')::integer as exact_count,
  count(*) filter (where ps.category in ('exact', 'goal_diff', 'tendency'))::integer as hit_count,
  max(pred.updated_at) as last_prediction_at,
  rank() over (
    partition by ps.tenant_id
    order by
      sum(ps.points) desc,
      count(*) filter (where ps.category = 'exact') desc,
      count(*) filter (where ps.category in ('exact', 'goal_diff', 'tendency')) desc,
      max(pred.updated_at) asc
  )::integer as rank
from public.prediction_score ps
join public.profile pr_profile on pr_profile.user_id = ps.user_id
join public.prediction pred on pred.id = ps.prediction_id
group by ps.tenant_id, ps.user_id, pr_profile.display_name;

grant select on public.leaderboard to authenticated;
