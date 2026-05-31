-- Two related capabilities:
--  1) Admins may enter predictions on behalf of any member of their group.
--  2) A per-group switch (member_tipping_enabled) that puts members in
--     view-only mode — they see fixtures and (admin-entered) tips but cannot
--     submit their own. Admins always retain write access.
--
-- The prediction deadline trigger still applies to everyone (no post-kickoff
-- writes), and the pre-kickoff secrecy SELECT policy is unchanged.

alter table public.tenant
  add column member_tipping_enabled boolean not null default true;

-- True if p_user is a member of p_tenant (not necessarily the current user).
-- SECURITY DEFINER + plpgsql like the other authorization helpers.
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

revoke all on function
  private.is_member_of(uuid, uuid),
  private.member_tipping_enabled(uuid)
from public, anon;
grant execute on function
  private.is_member_of(uuid, uuid),
  private.member_tipping_enabled(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Predictions: an admin may write for any member of the tenant; a member may
-- write only their own, and only while member tipping is enabled.
-- ---------------------------------------------------------------------------

drop policy prediction_insert on public.prediction;
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

drop policy prediction_update on public.prediction;
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
