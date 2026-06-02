-- MFA step-up enforcement -----------------------------------------------------
--
-- The /mfa challenge is enforced in the (app) layout (page render) only. Server
-- Actions and direct PostgREST/RPC calls do NOT pass through that layout, so an
-- attacker holding just the password of an MFA-enrolled user could sign in to an
-- aal1 session and still read/mutate via the API — defeating the second factor.
--
-- This migration makes the step-up a non-bypassable database gate, matching the
-- project's "RLS is the final gate" philosophy:
--   1. A SECURITY DEFINER helper private.mfa_satisfied() returns true unless the
--      caller has a VERIFIED factor while their session is still aal1.
--   2. RESTRICTIVE policies on the personal/tenant-scoped tables AND it onto the
--      existing permissive policies, so aal1-with-factor is denied every direct
--      read and write. (Permissive policies grant; one restrictive policy that
--      fails denies — so this cannot widen access, only narrow it.)
--   3. The user-mutation SECURITY DEFINER RPCs bypass RLS by design, so each
--      re-checks mfa_satisfied() explicitly (otherwise they would be a bypass).
--
-- Users WITHOUT a verified factor are unaffected (mfa_satisfied() is true at
-- aal1). The service role bypasses RLS entirely, so the sync job, leaderboard
-- and managed-member writes are untouched. The /mfa challenge itself uses the
-- GoTrue auth API (not these tables), so the gate never locks a user out of
-- completing their own step-up.

-- ===========================================================================
-- 1 — Helper: is the session's assurance level sufficient for this user?
-- ===========================================================================

create or replace function private.mfa_satisfied()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_aal text := (select auth.jwt() ->> 'aal');
begin
  -- A fully stepped-up session is always fine.
  if v_aal = 'aal2' then
    return true;
  end if;
  -- Otherwise (aal1 / unknown): satisfied only when the user has NO verified
  -- factor, i.e. nothing to step up to. A verified factor at aal1 => denied.
  return not exists (
    select 1
    from auth.mfa_factors f
    where f.user_id = (select auth.uid())
      and f.status = 'verified'
  );
end;
$$;

revoke all on function private.mfa_satisfied() from public, anon;
grant execute on function private.mfa_satisfied() to authenticated;

-- ===========================================================================
-- 2 — Restrictive aal2 gate on personal / tenant-scoped tables
-- ===========================================================================
--
-- `for all` + both using and with check so the gate covers SELECT/UPDATE/DELETE
-- (using) and INSERT/UPDATE (with check). The event spine (sport..fixture) and
-- app_setting are intentionally excluded: global, low-sensitivity reference data
-- (incl. the anon-readable launch toggles) that warrants no step-up.

create policy prediction_require_mfa on public.prediction
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy prediction_score_require_mfa on public.prediction_score
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy tenant_require_mfa on public.tenant
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy tenant_member_require_mfa on public.tenant_member
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy tenant_season_require_mfa on public.tenant_season
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy tenant_invite_require_mfa on public.tenant_invite
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy scoring_rule_set_require_mfa on public.scoring_rule_set
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy admin_audit_log_require_mfa on public.admin_audit_log
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy profile_require_mfa on public.profile
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

create policy site_admin_require_mfa on public.site_admin
  as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- ===========================================================================
-- 3 — Re-check the gate inside the user-mutation definer RPCs (RLS bypassers)
-- ===========================================================================
--
-- These run with owner rights and bypass RLS, so step 2 does not cover them.
-- Each re-checks private.mfa_satisfied() right after authentication. Bodies are
-- otherwise identical to the initial migration.

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

  if not private.mfa_satisfied() then
    raise exception 'Zwei-Faktor-Bestätigung erforderlich' using errcode = 'insufficient_privilege';
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

-- redeem_invite: also takes a row lock on the invite (FOR UPDATE) so concurrent
-- redemptions serialise and max_uses cannot be exceeded by a race.
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

  if not private.mfa_satisfied() then
    raise exception 'Zwei-Faktor-Bestätigung erforderlich' using errcode = 'insufficient_privilege';
  end if;

  -- Lock the invite row so the use-count check-and-increment is atomic under
  -- concurrent redemptions (otherwise two joins could both pass max_uses).
  select * into v_invite from public.tenant_invite where code = p_code for update;
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

  if not private.mfa_satisfied() then
    raise exception 'Zwei-Faktor-Bestätigung erforderlich' using errcode = 'insufficient_privilege';
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

create or replace function public.recompute_tenant(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture_id uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'Zwei-Faktor-Bestätigung erforderlich' using errcode = 'insufficient_privilege';
  end if;

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
