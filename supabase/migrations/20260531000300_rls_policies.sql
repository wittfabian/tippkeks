-- Row Level Security: the non-bypassable authorization gate.
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
-- The TIME gate on writes is the enforce_prediction_deadline() trigger;
-- RLS owns the WHO gate.
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
    user_id = (select auth.uid())
    and (select private.is_member(tenant_id))
    and (select private.fixture_in_tenant(tenant_id, fixture_id))
  );

create policy prediction_update on public.prediction
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

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
