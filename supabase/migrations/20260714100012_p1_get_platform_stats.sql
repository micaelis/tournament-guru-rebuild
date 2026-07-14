-- =====================================================================
-- P1 — Compute homepage stats without fetching every row
--
-- `getStats` (lib/supabase/queries.ts) computed
--   tournamentsCount = new Set(select event_profile_id from events …).size
-- which meant every homepage load fetched all non-draft event rows just
-- to count distinct grouping keys client-side. This RPC returns the
-- three homepage stats in one round-trip and computes the distinct
-- count in Postgres where it belongs.
-- =====================================================================

create or replace function public.get_platform_stats()
returns table (
  events_count      bigint,
  reviews_count     bigint,
  tournaments_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.events  where status <> 'draft')  as events_count,
    (select count(*) from public.reviews where published = true)   as reviews_count,
    (select count(distinct event_profile_id) from public.events
       where status <> 'draft' and event_profile_id is not null)   as tournaments_count;
$$;

grant execute on function public.get_platform_stats() to anon, authenticated;
