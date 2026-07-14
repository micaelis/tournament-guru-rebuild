-- =====================================================================
-- Tournament Guru — Find Events search: replace region filter with state
-- ---------------------------------------------------------------------
-- Per the June 18 client brief (Franco): the Find Events page should filter
-- by US state (2-letter codes) with a checkbox list, NOT by NCAA-style
-- regional codes (I / II / III / IV). This migration:
--   1. Recreates `search_events_page` with `p_states text[]` in place of
--      `p_regions text[]`. The rest of the signature/order/behaviour is
--      unchanged. Filters against `events.state` directly.
--   2. Rewrites `get_event_facets` to return `states` (distinct 2-letter
--      codes present on non-draft events) instead of `regions`.
--
-- The Next.js layer already reads either shape (see queries.ts) so
-- rolling this out is a safe hot-swap.
-- =====================================================================

-- Drop the previous function first because the parameter list changed.
-- (Postgres identifies functions by signature; the old p_regions variant
--  would otherwise still exist and get called ambiguously.)
drop function if exists public.search_events_page(
  text, text[], text[], text[], text[], text[], date, date, boolean, text, int, int
);

create or replace function public.search_events_page(
  p_q          text    default null,
  p_ages       text[]  default null,
  p_genders    text[]  default null,
  p_levels     text[]  default null,
  p_surfaces   text[]  default null,
  p_states     text[]  default null,
  p_date_start date    default null,
  p_date_end   date    default null,
  p_open_only  boolean default false,
  p_sort       text    default 'teams',
  p_limit      int     default 12,
  p_offset     int     default 0
)
returns table (
  id             uuid,
  title          text,
  description    text,
  owner_id       uuid,
  host_club      text,
  location_text  text,
  state          text,
  region         text,
  start_date     date,
  end_date       date,
  status         text,
  premium        boolean,
  logo           text,
  host_logo      text,
  general_rating numeric,
  reviews        integer,
  created_at     timestamptz,
  lat            double precision,
  lng            double precision,
  ages           text[],
  genders        text[],
  levels         text[],
  surfaces       text[],
  total_count    bigint
)
language sql
stable
as $$
  with params as (
    select nullif(btrim(coalesce(p_q, '')), '') as term
  ),
  filtered as (
    select
      e.*,
      case
        when (select term from params) is not null
          then ts_rank(e.search_vector,
                       websearch_to_tsquery('english', unaccent((select term from params))))
        else 0
      end as rank
    from events e
    where e.status <> 'draft'
      and (
        (select term from params) is null
        or e.search_vector @@ websearch_to_tsquery('english', unaccent((select term from params)))
        or e.search_document % (select term from params)
      )
      and (p_ages is null or cardinality(p_ages) = 0 or exists (
            select 1 from event_ages a
            where a.event_id = e.id and a.age::text = any(p_ages)))
      and (p_genders is null or cardinality(p_genders) = 0 or exists (
            select 1 from event_genders g
            where g.event_id = e.id and g.gender::text = any(p_genders)))
      and (p_levels is null or cardinality(p_levels) = 0 or exists (
            select 1 from event_competition_levels l
            where l.event_id = e.id and l.level::text = any(p_levels)))
      and (p_surfaces is null or cardinality(p_surfaces) = 0 or exists (
            select 1 from event_fields f
            where f.event_id = e.id and f.surface::text = any(p_surfaces)))
      -- Case-insensitive US-state match. events.state stores 2-letter codes.
      and (p_states is null or cardinality(p_states) = 0
           or upper(e.state) = any(select upper(x) from unnest(p_states) x))
      and (p_date_start is null or e.end_date   is null or e.end_date   >= p_date_start)
      and (p_date_end   is null or e.start_date is null or e.start_date <= p_date_end)
      and (not p_open_only or e.status = 'open')
  ),
  counted as (
    select f.*, count(*) over() as total_count
    from filtered f
  )
  select
    c.id,
    c.title,
    c.description,
    c.owner_id,
    c.host_club,
    c.location_text,
    c.state,
    c.region::text,
    c.start_date,
    c.end_date,
    c.status::text,
    c.premium,
    c.logo,
    (select v.org_logo from public.event_host_logos v where v.event_id = c.id) as host_logo,
    c.general_rating,
    c.reviews,
    c.created_at,
    st_y(c.location::geometry) as lat,
    st_x(c.location::geometry) as lng,
    array(select a.age::text   from event_ages a               where a.event_id = c.id order by a.age)   as ages,
    array(select g.gender::text from event_genders g           where g.event_id = c.id order by g.gender) as genders,
    array(select l.level::text from event_competition_levels l where l.event_id = c.id order by l.level)  as levels,
    array(select fs.surface::text from event_fields fs         where fs.event_id = c.id order by fs.surface) as surfaces,
    c.total_count
  from counted c
  order by
    -- "teams" is the new default (was "recommended"); "recommended" mapped
    -- to teams by the client so the URL history keeps working.
    (case when p_sort = 'teams'  then c.nr_teams_last_year end) desc nulls last,
    (case when p_sort = 'date'   then c.start_date         end) asc  nulls last,
    (case when p_sort = 'rating' then c.general_rating     end) desc nulls last,
    -- premium leads within the chosen sort so paid placements still surface
    c.premium desc nulls last,
    c.rank desc,
    c.general_rating desc nulls last,
    c.created_at desc
  limit  greatest(coalesce(p_limit, 12), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_events_page(
  text, text[], text[], text[], text[], text[], date, date, boolean, text, int, int
) to anon, authenticated;

-- ---------------------------------------------------------------------
-- get_event_facets — now returns `states` (2-letter codes) alongside the
-- other enum domains. Regions are kept for one migration cycle so the
-- app can read whichever shape the DB currently has during rollout.
-- ---------------------------------------------------------------------
create or replace function public.get_event_facets()
returns json
language sql
stable
as $$
  select json_build_object(
    'ages', coalesce((
      select array_agg(distinct a.age::text order by a.age::text)
      from event_ages a join events e on e.id = a.event_id
      where e.status <> 'draft'), '{}'),
    'genders', coalesce((
      select array_agg(distinct g.gender::text order by g.gender::text)
      from event_genders g join events e on e.id = g.event_id
      where e.status <> 'draft'), '{}'),
    'levels', coalesce((
      select array_agg(distinct l.level::text order by l.level::text)
      from event_competition_levels l join events e on e.id = l.event_id
      where e.status <> 'draft'), '{}'),
    'surfaces', coalesce((
      select array_agg(distinct f.surface::text order by f.surface::text)
      from event_fields f join events e on e.id = f.event_id
      where e.status <> 'draft'), '{}'),
    'states', coalesce((
      select array_agg(distinct upper(e.state) order by upper(e.state))
      from events e
      where e.status <> 'draft' and e.state is not null and length(trim(e.state)) > 0), '{}')
  );
$$;

grant execute on function public.get_event_facets() to anon, authenticated;
