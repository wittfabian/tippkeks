-- ===========================================================================
-- public schema role privileges (anon / authenticated / service_role)
-- ===========================================================================
--
-- The authorization model assumes the PostgREST roles hold table-level
-- privileges on public, with RLS as the actual gate ("a table with RLS enabled
-- but no policy is locked; without RLS it's wide open to the anon key"). Supabase
-- normally wires these grants up via default privileges out of the box.
--
-- On this deployment they are MISSING: the sync job (service_role) failed with
--   42501  permission denied for table sport
-- and authenticated reads of own rows (profile, site_admin, tenant, …) silently
-- returned empty — supabase-js surfaces a permission error that callers treat as
-- "no row", so the profile display name, the site-admin nav, and the group list
-- vanished even though the data and RLS policies were correct.
--
-- Grant the privileges the design assumes. RLS still gates every row.
--
--  * authenticated: full table/sequence access; RLS scopes it to the caller's rows.
--  * service_role:   full access; bypasses RLS by design (sync job, admin overrides).
--  * anon:           ONLY select on app_setting — the single anon access path is the
--                    register page reading the public launch toggles pre-session.
--                    Deliberately NOT a blanket grant: keeping anon minimal means a
--                    future table that forgets to enable RLS is not silently exposed
--                    to the anon key. Everything else is `to authenticated` anyway.
--
-- Functions are intentionally NOT granted here: the trigger functions are
-- deliberately revoked from anon/authenticated to keep them off the PostgREST RPC
-- surface, and the callable RPCs grant EXECUTE explicitly where intended.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant all on tables to authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to authenticated, service_role;

-- anon: just the public feature toggles the register page needs before any session.
grant select on public.app_setting to anon;
