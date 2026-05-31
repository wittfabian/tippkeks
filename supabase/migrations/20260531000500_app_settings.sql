-- App-wide settings and the site-admin role.
--
-- Until now authorization was purely per-tenant (admin|member). Two controls are
-- genuinely global — whether new accounts may register and whether members may
-- create groups — so they need an operator who sits above any single tenant.
-- That operator is a `site_admin`; the toggles live in `app_setting`.

-- ---------------------------------------------------------------------------
-- Site admins: operators of the whole installation.
-- ---------------------------------------------------------------------------

create table public.site_admin (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

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

revoke all on function private.is_site_admin() from public, anon;
grant execute on function private.is_site_admin() to authenticated;

alter table public.site_admin enable row level security;

-- A user may see only their own row (enough to learn "am I a site admin?").
-- There are deliberately no write policies: membership is granted out-of-band
-- via the service role (scripts/set-site-admin.ts), never self-service.
create policy site_admin_select_self on public.site_admin
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- App settings: small key/JSONB store for global feature toggles.
-- ---------------------------------------------------------------------------

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

alter table public.app_setting enable row level security;

-- These flags are not secret: the (anon) register page must read
-- registration_enabled before any session exists. Writes are site-admin only.
create policy app_setting_select on public.app_setting
  for select to anon, authenticated
  using (true);

create policy app_setting_update on public.app_setting
  for update to authenticated
  using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));

create trigger app_setting_set_updated_at
  before update on public.app_setting
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enforce the group-creation toggle inside create_group() (non-bypassable).
-- The Server Action also checks it, but RLS/definer is the final gate. Site
-- admins always bypass the toggle. Body is otherwise identical to migration 400.
-- ---------------------------------------------------------------------------

create or replace function public.create_group(p_name text, p_slug text)
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

  insert into public.tenant (name, slug, created_by)
  values (p_name, lower(p_slug), v_uid)
  returning * into v_tenant;

  insert into public.tenant_member (tenant_id, user_id, role)
  values (v_tenant.id, v_uid, 'admin');

  insert into public.scoring_rule_set (tenant_id, version, config, is_active)
  values (
    v_tenant.id,
    1,
    '{"exact": 4, "goal_diff": 3, "tendency": 2, "advance_bonus": 2, "stage_multipliers": {}}'::jsonb,
    true
  );

  insert into public.tenant_season (tenant_id, season_id)
  select v_tenant.id, s.id from public.season s;

  insert into public.admin_audit_log (tenant_id, actor_id, action, target_type, target_id)
  values (v_tenant.id, v_uid, 'tenant_create', 'tenant', v_tenant.id::text);

  return v_tenant;
end;
$$;

revoke all on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;
