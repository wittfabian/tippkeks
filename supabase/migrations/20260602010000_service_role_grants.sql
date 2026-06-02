-- ===========================================================================
-- service_role table privileges
-- ===========================================================================
--
-- The architecture treats service_role as the trusted server key: the sync job
-- writes the event spine directly (`.from("sport").upsert(...)`, etc.) and the
-- cache reads global data with it. The RLS policies deliberately define no write
-- policies for these tables ("written only by service_role which bypasses RLS").
--
-- But bypassing RLS is NOT the same as holding the underlying table GRANT — a
-- role still needs SELECT/INSERT/UPDATE privileges on the table. Supabase Cloud
-- wires these up via default privileges out of the box; self-hosted / external
-- Postgres deployments may not, which surfaces as the sync job failing with
--   42501  permission denied for table sport
-- even though service_role can bypass RLS.
--
-- Grant service_role the access the design assumes, and set default privileges
-- so any table/sequence added by a later migration is covered too. This is not a
-- privilege escalation: service_role is already the all-powerful server-only key
-- (it bypasses RLS); the only thing missing was the table-level grant.

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
