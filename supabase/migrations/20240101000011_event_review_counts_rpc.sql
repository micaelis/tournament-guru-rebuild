-- ---------------------------------------------------------------------
-- Per-event, per-type review COUNTS for the featured-event cards.
--
-- The events table denormalizes the three *ratings* (general/coach/attendee)
-- and a single *total* review count, but not the per-type counts. This RPC
-- returns them for a batch of events, using the EXACT same coach/attendee
-- split that recalc_event_ratings() uses (see 20240101000002), so the counts
-- line up 1:1 with coach_rating / attendee_rating:
--   * coach    = published reviews whose user_role matches '%coach%'
--   * attendee = every other published review (parents, spectators, managers…)
--
-- SECURITY DEFINER with a locked search_path: only aggregates published
-- reviews (already publicly readable via RLS), returns nothing else.
-- ---------------------------------------------------------------------
create or replace function public.get_event_review_counts(p_event_ids uuid[])
returns table (
  event_id         uuid,
  coach_reviews    integer,
  attendee_reviews integer,
  total_reviews    integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.event_id,
    count(*) filter (where r.user_role ilike '%coach%')::int as coach_reviews,
    count(*) filter (
      where r.user_role is null or r.user_role not ilike '%coach%'
    )::int as attendee_reviews,
    count(*)::int as total_reviews
  from public.reviews r
  where r.published = true
    and r.event_id = any(p_event_ids)
  group by r.event_id;
$$;

grant execute on function public.get_event_review_counts(uuid[]) to anon, authenticated;
