-- Core schema: the event spine, multi-tenancy, predictions, scoring and audit.
--
-- Naming: the tenant (a closed player group) is `tenant` internally; the German
-- UI labels it "Gruppe". Every externally-synced entity carries (provider,
-- external_id) so re-syncs are idempotent and the data source is swappable.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Event spine: sport -> competition -> season -> stage -> fixture, plus team
-- ---------------------------------------------------------------------------

create table public.sport (
  id smallint generated always as identity primary key,
  key text not null unique,
  name text not null
);

create table public.competition (
  id bigint generated always as identity primary key,
  sport_id smallint not null references public.sport (id),
  name text not null,
  provider text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.season (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competition (id) on delete cascade,
  label text not null,
  starts_on date,
  ends_on date,
  provider text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.stage (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.season (id) on delete cascade,
  kind stage_kind not null,
  name text not null,
  ordinal smallint not null,
  unique (season_id, ordinal)
);

create table public.team (
  id bigint generated always as identity primary key,
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
  id bigint generated always as identity primary key,
  season_id bigint not null references public.season (id) on delete cascade,
  stage_id bigint references public.stage (id) on delete set null,
  matchday smallint,
  home_team_id bigint references public.team (id),
  away_team_id bigint references public.team (id),
  kickoff_at timestamptz not null,
  status fixture_status not null default 'scheduled',
  -- Regulation (90') result — the basis for score predictions.
  regular_home smallint,
  regular_away smallint,
  -- Knockout extras.
  after_extra_time boolean not null default false,
  penalty_home smallint,
  penalty_away smallint,
  winner_team_id bigint references public.team (id),
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
  slug text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tenant_name_len check (char_length(name) between 2 and 80),
  constraint tenant_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$')
);

create table public.tenant_member (
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Policy-referenced columns get explicit indexes (see RLS migration rationale).
create index tenant_member_user_idx on public.tenant_member (user_id);
create index tenant_member_tenant_role_idx on public.tenant_member (tenant_id, role);

create table public.tenant_season (
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  season_id bigint not null references public.season (id) on delete cascade,
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
  fixture_id bigint not null references public.fixture (id) on delete cascade,
  home_goals smallint not null,
  away_goals smallint not null,
  advancing_team_id bigint references public.team (id),
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
  fixture_id bigint not null references public.fixture (id) on delete cascade,
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
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action audit_action not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_tenant_idx on public.admin_audit_log (tenant_id, created_at desc);
