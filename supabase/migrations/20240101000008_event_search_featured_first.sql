-- =====================================================================
-- search_events_page v2 — featured (premium/paid) events ALWAYS lead, and
-- expose nr_teams_last_year so result cards can show a "N teams" chip.
--
-- Supersedes the definition from migration 000007. The return signature gains
-- a `teams` column, so the function is dropped and recreated (create-or-replace
-- can't change the return type).
-- =====================================================================

drop function if exists public.search_events_page(
  text, text[], text[], text[], text[], text[], date, date, boolean, text, int, int
);

create function public.search_events_page(
  p_q          text    default null,
  p_ages       text[]  default null,
  p_genders    text[]  default null,
  p_levels     text[]  default null,
  p_surfaces   text[]  default null,
  p_regions    text[]  default null,
  p_date_start date    default null,
  p_date_end   date    default null,
  p_open_only  boolean default false,
  p_sort       text    default 'recommended',
  p_limit      int     default 12,
  p_offset     int     default 0
)
returns table (
  id             uuid,
  title          text,
  description    text,
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
  teams          integer,
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
      and (p_regions is null or cardinality(p_regions) = 0
           or e.region::text = any(p_regions))
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
    c.nr_teams_last_year as teams,
    array(select a.age::text   from event_ages a               where a.event_id = c.id order by a.age)   as ages,
    array(select g.gender::text from event_genders g           where g.event_id = c.id order by g.gender) as genders,
    array(select l.level::text from event_competition_levels l where l.event_id = c.id order by l.level)  as levels,
    array(select fs.surface::text from event_fields fs         where fs.event_id = c.id order by fs.surface) as surfaces,
    c.total_count
  from counted c
  order by
    -- Featured (paid) events ALWAYS lead, regardless of the chosen sort.
    c.premium desc nulls last,
    (case when p_sort = 'date'   then c.start_date     end) asc  nulls last,
    (case when p_sort = 'rating' then c.general_rating end) desc nulls last,
    (case when p_sort = 'teams'  then c.nr_teams_last_year end) desc nulls last,
    (case when p_sort = 'recommended' then c.rank end) desc nulls last,
    c.rank desc,
    c.general_rating desc nulls last,
    c.created_at desc
  limit  greatest(coalesce(p_limit, 12), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_events_page(
  text, text[], text[], text[], text[], text[], date, date, boolean, text, int, int
) to anon, authenticated;
