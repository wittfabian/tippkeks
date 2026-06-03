-- ===========================================================================
-- Security hardening
-- ===========================================================================
--
-- 1) email_in_use: LANGUAGE sql SECURITY DEFINER → plpgsql. A `language sql`
--    definer function is inlined at plan time, which drops the definer context
--    (the project-wide invariant, see the initial migration's SECTION 3). Switch
--    to plpgsql so the definer rights actually hold when it reads auth.users.
-- 2) merge_managed_member: a tenant admin could previously merge a managed
--    placeholder onto ANY real account by email — silently adding that account to
--    the group and overwriting its predictions, with no consent. Require the
--    target to already be a member of the tenant (no auto-insert), so a stranger
--    can never be pulled in. The within-group conflict policy ("managed wins")
--    is unchanged; it now only ever touches a consenting fellow member's data.
-- 3) app_setting: the authenticated SELECT policy was `using (true)`, exposing
--    every key to any signed-in user. Scope it to the two public toggles (plus
--    site admins), so a future secret-bearing key isn't auto-readable.

-- 1 — email_in_use → plpgsql -------------------------------------------------
create or replace function public.email_in_use(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (select 1 from auth.users where lower(email) = lower(p_email));
end;
$$;

revoke all on function public.email_in_use(text) from public, anon, authenticated;
grant execute on function public.email_in_use(text) to service_role;

-- 2 — merge_managed_member requires the target to be a member already ---------
create or replace function public.merge_managed_member(
  p_tenant uuid,
  p_managed_user uuid,
  p_target_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
  v_managed boolean;
begin
  select id into v_target from auth.users where lower(email) = lower(p_target_email);
  if v_target is null then
    raise exception 'Kein Konto mit dieser E-Mail-Adresse' using errcode = 'no_data_found';
  end if;
  if v_target = p_managed_user then
    raise exception 'Quelle und Ziel sind identisch' using errcode = 'check_violation';
  end if;

  select managed into v_managed from public.profile where user_id = p_managed_user;
  if v_managed is not true then
    raise exception 'Quelle ist kein verwaltetes Mitglied' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.tenant_member
    where tenant_id = p_tenant and user_id = p_managed_user
  ) then
    raise exception 'Verwaltetes Mitglied gehört nicht zu dieser Gruppe'
      using errcode = 'check_violation';
  end if;

  -- The target must ALREADY belong to this group. We never silently add an
  -- arbitrary real account (identified only by an admin-supplied email) to the
  -- tenant — that would let an admin pull a non-consenting stranger in and
  -- overwrite their predictions. The real person joins via invite first.
  if not exists (
    select 1 from public.tenant_member
    where tenant_id = p_tenant and user_id = v_target
  ) then
    raise exception 'Zielkonto ist kein Mitglied dieser Gruppe'
      using errcode = 'check_violation';
  end if;

  -- Conflict policy "managed wins": drop the target's own prediction for any
  -- fixture the placeholder also tipped (its score cascades), so the subsequent
  -- ownership move cannot hit the (tenant, user, fixture) unique constraint.
  delete from public.prediction tgt
  where tgt.tenant_id = p_tenant
    and tgt.user_id = v_target
    and exists (
      select 1 from public.prediction src
      where src.tenant_id = p_tenant
        and src.user_id = p_managed_user
        and src.fixture_id = tgt.fixture_id
    );

  -- Reassign ownership. Allowed past kickoff because content is untouched (the
  -- refined deadline trigger only blocks late content changes).
  update public.prediction
    set user_id = v_target
  where tenant_id = p_tenant and user_id = p_managed_user;

  update public.prediction_score
    set user_id = v_target
  where tenant_id = p_tenant and user_id = p_managed_user;

  -- The placeholder no longer owns anything; remove the synthetic account. FKs
  -- cascade its profile and its (now tip-free) membership row.
  delete from auth.users where id = p_managed_user;
end;
$$;

revoke all on function public.merge_managed_member(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_managed_member(uuid, uuid, text) to service_role;

-- 3 — app_setting authenticated SELECT scoped to public keys (+ site admin) ---
drop policy if exists app_setting_select_authed on public.app_setting;

create policy app_setting_select_authed on public.app_setting
  for select to authenticated
  using (
    key in ('registration_enabled', 'group_creation_enabled')
    or (select private.is_site_admin())
  );

-- 4 — email_member_of: does the account with this email already belong to the
--     tenant? Lets convertManagedMemberAction give the admin a clear, actionable
--     message up front (merge requires the target to already be a member, see 2)
--     instead of failing only after the merge confirmation. SECURITY DEFINER to
--     read auth.users; service_role only (the convert action runs as service_role).
create or replace function public.email_member_of(p_tenant uuid, p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    return false;
  end if;
  return exists (
    select 1 from public.tenant_member
    where tenant_id = p_tenant and user_id = v_user
  );
end;
$$;

revoke all on function public.email_member_of(uuid, text) from public, anon, authenticated;
grant execute on function public.email_member_of(uuid, text) to service_role;
