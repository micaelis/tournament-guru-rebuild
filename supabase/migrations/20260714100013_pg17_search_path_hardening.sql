-- =====================================================================
-- PG17 search_path hardening for pre-existing SECURITY DEFINER functions
--
-- The historical migrations (000001, 000003, 000011, 000014, 000017)
-- declared SECURITY DEFINER functions with `SET search_path = public`.
-- That resolves the schema correctly but doesn't include `pg_temp` —
-- a hostile session could `CREATE TEMP FUNCTION public.some_name(...)`
-- and see it preferred over the real `public.some_name` during the
-- DEFINER call. Adding `pg_temp` LAST in the search_path pins temp
-- resolution to a schema Postgres owns.
--
-- Impact on PG17 specifically: PG16+ tightened `search_path` handling
-- for DEFINER functions and Supabase Advisors now flags any DEFINER
-- without `pg_temp` in its path. This migration removes those flags
-- and closes the (small) temp-schema hijack vector.
--
-- Uses ALTER FUNCTION rather than CREATE OR REPLACE so we don't need
-- to duplicate each function body here.
-- =====================================================================

alter function public.is_admin()
  set search_path = public, pg_temp;

alter function public.handle_new_user()
  set search_path = public, pg_temp;

alter function public.needs_password_setup(text)
  set search_path = public, pg_temp;

alter function public.get_event_review_counts(uuid[])
  set search_path = public, pg_temp;

alter function public.get_director_profile(uuid)
  set search_path = public, pg_temp;

-- get_event_directors was recreated in 20260714100004 with search_path
-- already including pg_temp; the ALTER above touching it a second time
-- is a no-op.
