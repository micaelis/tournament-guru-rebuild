-- =====================================================================
-- M12 — Pick the most-typed casing for popular searches
--
-- `get_popular_searches` grouped case-insensitively but the displayed
-- term was `(array_agg(btrim(term) order by 1))[1]` — i.e. the
-- alphabetically-first casing. A single early "SOCCER" pinned the
-- display to all-caps even after 500 users typed "soccer". Switch to
-- `mode() within group (order by btrim(term))` so the term that was
-- actually typed most often wins the display slot.
-- =====================================================================

create or replace function public.get_popular_searches(
  p_limit int default 3,
  p_days  int default 120
)
returns table (term text, hits bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    mode() within group (order by btrim(term)) as term,
    count(*) as hits
  from public.search_queries
  where created_at >= now() - make_interval(days => greatest(1, p_days))
    and char_length(btrim(term)) between 2 and 40
  group by lower(btrim(term))
  order by count(*) desc, 1 asc
  limit greatest(1, least(10, p_limit));
$$;

grant execute on function public.get_popular_searches(int, int) to anon, authenticated;
