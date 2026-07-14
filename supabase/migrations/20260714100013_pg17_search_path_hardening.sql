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
-- Uses ALTER FUNCTION inside a DO block with existence checks so it
-- succeeds against DBs where the hand-bootstrap missed one of the
-- historical migrations. Skipped functions emit a NOTICE.
-- =====================================================================

do $$
declare
  targets text[][] := array[
    array['public.is_admin', ''],
    array['public.handle_new_user', ''],
    array['public.needs_password_setup', 'text'],
    array['public.get_event_review_counts', 'uuid[]'],
    array['public.get_director_profile', 'uuid']
  ];
  spec text[];
  fn_qual text;
  fn_args text;
  fn_regproc regprocedure;
begin
  foreach spec slice 1 in array targets loop
    fn_qual := spec[1];
    fn_args := spec[2];
    begin
      fn_regproc := (fn_qual || '(' || fn_args || ')')::regprocedure;
    exception when undefined_function then
      raise notice 'skip: % not found', fn_qual;
      continue;
    end;
    execute format('alter function %s set search_path = public, pg_temp', fn_regproc);
  end loop;
end $$;

-- get_event_directors was recreated in 20260714100004 with search_path
-- already including pg_temp; not touched here.
