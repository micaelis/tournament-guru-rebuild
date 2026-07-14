-- =====================================================================
-- H11 — `SET search_path` hygiene on remaining functions + view intent
--
-- All SECURITY DEFINER functions were already hardened with
-- `set search_path = public` when they were written. The remaining
-- INVOKER functions (rating recalc, search-document builder, trigger
-- helpers) were not, which means a hostile session `search_path` could
-- (in principle) shadow a `public.` reference during execution and
-- redirect a call. Impact is low today because these run under the
-- caller's role and RLS-protected tables would still block writes, but
-- pinning search_path costs nothing and is a Supabase best practice.
--
-- Also asserts `security_invoker = false` on the two directory views,
-- so their bypass-RLS intent survives future Postgres upgrades that
-- change the view-behavior default.
--
-- Each ALTER is guarded with a pg_proc / pg_class existence check so
-- the migration succeeds against DBs that were hand-bootstrapped and
-- may be missing some of the historical function definitions. If an
-- object is missing on the target, the ALTER is skipped and a NOTICE
-- is emitted for visibility.
-- =====================================================================

-- Helper: harden search_path on a function only if it exists (identity
-- signature match). Skips silently if the function isn't present.
--
-- Functions that call helpers from the `extensions` schema (unaccent,
-- pg_trgm operators) need `extensions` in the path — Supabase Cloud
-- installs extensions into a dedicated schema, and it isn't in the
-- default search_path during `db push` sessions. The `path` column
-- picks between the two flavours.
do $$
declare
  targets text[][] := array[
    -- name, args, path
    array['public.recalc_event_ratings', 'uuid', 'public, pg_temp'],
    array['public.trg_reviews_recalc', '', 'public, pg_temp'],
    array['public.build_event_search_document', 'public.events', 'public, extensions, pg_temp'],
    array['public.trg_event_search', '', 'public, extensions, pg_temp'],
    array['public.trg_refresh_event_search_from_child', '', 'public, pg_temp'],
    array['public.stamp_premium_at', '', 'public, pg_temp'],
    array['public.search_events_page',
      'text, text[], text[], text[], text[], text[], date, date, boolean, text, int, int',
      'public, extensions, pg_temp'],
    array['public.get_event_facets', '', 'public, pg_temp']
  ];
  spec text[];
  fn_qual text;
  fn_args text;
  fn_path text;
  fn_regproc regprocedure;
begin
  foreach spec slice 1 in array targets loop
    fn_qual := spec[1];
    fn_args := spec[2];
    fn_path := spec[3];
    begin
      fn_regproc := (fn_qual || '(' || fn_args || ')')::regprocedure;
    exception when undefined_function then
      raise notice 'skip: % not found', fn_qual;
      continue;
    end;
    execute format('alter function %s set search_path = %s', fn_regproc, fn_path);
  end loop;
end $$;

-- ── Directory views — pin DEFINER semantics explicitly ──────────────
-- These views live specifically to expose a narrow safe projection of
-- profiles data (`org_logo`, `user_type`, `attendee_type`) that RLS on
-- the base table would block. The bypass-RLS behavior is DELIBERATE.
-- Postgres 15+ defaults new views to `security_invoker = true`; if a
-- future recreate or environment upgrade flips that default, these
-- views would suddenly return zero rows. Pin the intent.
do $$
begin
  if to_regclass('public.review_author_badges') is not null then
    execute 'alter view public.review_author_badges set (security_invoker = false)';
  else
    raise notice 'skip: view public.review_author_badges not found';
  end if;
  if to_regclass('public.event_host_logos') is not null then
    execute 'alter view public.event_host_logos set (security_invoker = false)';
  else
    raise notice 'skip: view public.event_host_logos not found';
  end if;
end $$;
