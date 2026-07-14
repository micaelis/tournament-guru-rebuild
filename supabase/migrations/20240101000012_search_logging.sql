-- ---------------------------------------------------------------------
-- Popular searches — logging + aggregation.
--
-- The hero's "Popular" chips were hardcoded because nothing recorded what
-- people actually search for. This adds:
--   * search_queries : an append-only log of submitted search terms
--   * get_popular_searches() : the top-N terms over a recent window
--
-- Privacy: rows are write-only for the public (insert policy, no select
-- policy), so raw terms are never publicly readable — only the aggregated
-- top-N is exposed, via a SECURITY DEFINER function.
-- ---------------------------------------------------------------------
-- Uses gen_random_uuid() (built into PG13+) instead of the uuid-ossp
-- helper — Supabase Cloud installs uuid-ossp into the `extensions`
-- schema, which isn't in the search_path during `db push`, so the
-- extension helper isn't reachable here. gen_random_uuid() needs no
-- extension.
create table if not exists public.search_queries (
  id         uuid primary key default gen_random_uuid(),
  term       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_queries_created on public.search_queries(created_at desc);

alter table public.search_queries enable row level security;

-- Anyone may log a search (bounded length); nobody may read the raw rows.
create policy "search_queries: anyone log"
  on public.search_queries for insert
  with check (char_length(btrim(term)) between 2 and 60);

-- Top normalized search terms over a recent window. Grouped case-insensitively;
-- the most-typed original casing is shown.
create or replace function public.get_popular_searches(
  p_limit int default 3,
  p_days  int default 120
)
returns table (term text, hits bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (array_agg(btrim(term) order by 1))[1] as term,
    count(*) as hits
  from public.search_queries
  where created_at >= now() - make_interval(days => greatest(1, p_days))
    and char_length(btrim(term)) between 2 and 40
  group by lower(btrim(term))
  order by count(*) desc, 1 asc
  limit greatest(1, least(10, p_limit));
$$;

grant execute on function public.get_popular_searches(int, int) to anon, authenticated;
