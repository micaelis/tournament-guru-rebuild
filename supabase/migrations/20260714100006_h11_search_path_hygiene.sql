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
-- =====================================================================

-- ── Rating recalculation and its trigger ────────────────────────────
alter function public.recalc_event_ratings(uuid)
  set search_path = public, pg_temp;

alter function public.trg_reviews_recalc()
  set search_path = public, pg_temp;

-- ── Search document builder and its triggers ────────────────────────
alter function public.build_event_search_document(public.events)
  set search_path = public, pg_temp;

alter function public.trg_event_search()
  set search_path = public, pg_temp;

alter function public.trg_refresh_event_search_from_child()
  set search_path = public, pg_temp;

-- ── Premium timestamp stamper ───────────────────────────────────────
alter function public.stamp_premium_at()
  set search_path = public, pg_temp;

-- ── Public search RPCs (INVOKER) ────────────────────────────────────
alter function public.search_events_page(
  text, text[], text[], text[], text[], text[], date, date, boolean, text, int, int
) set search_path = public, pg_temp;

alter function public.get_event_facets()
  set search_path = public, pg_temp;

-- ── Directory views — pin DEFINER semantics explicitly ──────────────
-- These views live specifically to expose a narrow safe projection of
-- profiles data (`org_logo`, `user_type`, `attendee_type`) that RLS on
-- the base table would block. The bypass-RLS behavior is DELIBERATE.
-- Postgres 15+ defaults new views to `security_invoker = true`; if a
-- future recreate or environment upgrade flips that default, these
-- views would suddenly return zero rows. Pin the intent.
alter view public.review_author_badges set (security_invoker = false);
alter view public.event_host_logos    set (security_invoker = false);
