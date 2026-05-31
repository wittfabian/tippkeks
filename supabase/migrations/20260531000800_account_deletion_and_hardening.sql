-- Hardening pass.
--
-- 1) Atomic self-service account deletion. Previously the Server Action deleted
--    "solo" groups with the cookie client and then deleted the auth user in a
--    separate step — not atomic, so a failure between the two could destroy
--    groups while reporting an error. This RPC does it all in one transaction.
-- 2) Tighten the anon read on app_setting to the known-public keys so the table
--    can never leak a future sensitive flag to the anon key.

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
-- app_setting: only the known public toggles are anon-readable (the register
-- page needs registration_enabled pre-session). Future keys are private by
-- default. Authenticated users may still read everything.
-- ---------------------------------------------------------------------------

drop policy app_setting_select on public.app_setting;

create policy app_setting_select_public on public.app_setting
  for select to anon
  using (key in ('registration_enabled', 'group_creation_enabled'));

create policy app_setting_select_authed on public.app_setting
  for select to authenticated
  using (true);
