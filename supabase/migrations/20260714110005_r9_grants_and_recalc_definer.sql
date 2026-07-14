-- =====================================================================
-- R9 — Restore standard Supabase role grants + fix review-trigger chain
--
-- Post-push smoke test surfaced three related grant problems:
--
--   1. `service_role` had zero SELECT/INSERT/UPDATE/DELETE on any
--      public table. Fresh Supabase Cloud projects come with those
--      grants baked in; this staging DB was hand-bootstrapped and
--      never inherited them. Every server action that uses the
--      service_role key would fail with "permission denied".
--
--   2. `search_queries` (created by 000012) had no INSERT grant to
--      `anon` or `authenticated`, so the app's /api/search-log route
--      has been silently failing for weeks. Insert policy exists;
--      the underlying table grant did not.
--
--   3. `recalc_event_ratings(uuid)` is SECURITY INVOKER, so the
--      after-insert/update trigger on `reviews` ran under the
--      caller's role. When an authenticated user inserts a review,
--      the trigger tries to UPDATE the aggregate columns on the
--      `events` row — but authenticated has no UPDATE on events, so
--      the review insert fails with "permission denied for table
--      events". Latent because Bubble-imported reviews were loaded as
--      superuser and the app's review UI is still Coming Soon; the
--      moment a real user tries to submit a review, it breaks.
--
-- All three are boilerplate mistakes in the hand-bootstrap. This
-- migration fixes them and folds the intent back into the migration
-- tree (000012 also updated to include its own grant, so a fresh
-- client project doesn't need to run R9 to boot).
-- =====================================================================

-- ── 1. Standard Supabase service_role grants on the public schema ──
-- These match what Supabase Cloud auto-grants on new projects. Making
-- them idempotent here so this migration is safe to re-run.
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables    in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;

-- Default privileges so any future table/sequence/function in public
-- inherits the same grants (avoids drift as new migrations land).
alter default privileges in schema public grant all on tables    to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;

-- ── 2. search_queries needs anon+authenticated INSERT ──
grant insert on public.search_queries to anon, authenticated;

-- ── 3. recalc_event_ratings must be SECURITY DEFINER ──
-- The trigger chain trg_reviews_recalc → recalc_event_ratings updates
-- aggregate columns on `events`. Authenticated users (who insert
-- reviews) don't have UPDATE on events (per RLS + C1's column-scope
-- posture). DEFINER runs it as the function owner (postgres), which
-- has full grants and RLS bypass — appropriate here because the
-- function only writes aggregate ratings/counts on the parent event,
-- based on the reviews the trigger fires from.
--
-- Also pins search_path to close the temp-schema hijack window.
alter function public.recalc_event_ratings(uuid) security definer;
alter function public.recalc_event_ratings(uuid) set search_path = public, pg_temp;

comment on function public.recalc_event_ratings(uuid) is
  'SECURITY DEFINER: fires from trg_reviews_recalc under authenticated users who cannot UPDATE events directly. Only writes aggregate rating/count columns on the target event; does not read PII or return values.';
