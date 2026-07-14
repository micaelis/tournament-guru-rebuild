-- =====================================================================
-- Event Directors public directory — About Us · Meet Our Team page
--
-- Aggregates every event director's public info + their portfolio stats
-- in a single trip: total events posted, cumulative published reviews,
-- and a review-weighted average rating across those events. Weighting by
-- review count (rather than a plain avg of general_rating) prevents a
-- one-review event from having the same pull as a fifty-review event.
--
-- SECURITY DEFINER with a locked search_path so `profiles` RLS can stay
-- locked to self+admin — this RPC only ever returns the same narrow,
-- non-sensitive projection the marketing page needs (name, email, logo,
-- portfolio counts). Follows the same pattern as event_host_logos and
-- get_event_review_counts.
-- =====================================================================

create or replace function public.get_event_directors(
  p_limit  int default 12,
  p_offset int default 0
)
returns table (
  id                uuid,
  display_name      text,
  contact_email     text,
  profile_picture   text,
  org_logo          text,
  club_affiliation  text,
  event_count       int,
  total_reviews     int,
  avg_rating        numeric,
  total_count       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      p.id,
      p.created_at,
      coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')
      ) as display_name,
      p.contact_email,
      p.profile_picture,
      p.org_logo,
      p.club_affiliation,
      count(distinct e.id)::int as event_count,
      coalesce(sum(e.reviews), 0)::int as total_reviews,
      -- Review-weighted average across events; only events with reviews
      -- contribute, so a director with no ratings anywhere gets 0.
      case
        when coalesce(sum(e.reviews) filter (where e.reviews > 0), 0) > 0 then (
          sum(coalesce(e.general_rating, 0) * e.reviews)
            filter (where e.reviews > 0)
          / nullif(sum(e.reviews) filter (where e.reviews > 0), 0)
        )::numeric(3,2)
        else 0::numeric(3,2)
      end as avg_rating,
      -- Curated pinning: the three directors below are surfaced first on
      -- the About Us grid in this exact order, regardless of activity. Any
      -- other director falls through to the recency-based tail sort.
      case lower(p.contact_email)
        when 'tournaments@loufuszathletic.com' then 1
        when 'loufuszfranco@gmail.com'         then 2
        when 'mbohnak@slsgsoccer.com'          then 3
        else 999
      end as pin_order
    from public.profiles p
    join public.events e on e.owner_id = p.id
    where p.user_type = 'event_director'
      and p.status = 'active'
      and e.status <> 'draft'
      -- Exclude obvious placeholder / test director emails so the marketing
      -- grid never surfaces a "testdirector@test.com" style row.
      and (
        p.contact_email is null
        or (
          p.contact_email not ilike '%test%'
          and p.contact_email not ilike '%example.com%'
        )
      )
    group by p.id, p.created_at
  ),
  ranked as (
    select *
    from base
    where display_name is not null
    order by pin_order asc, created_at desc, display_name asc
  )
  select
    r.id,
    r.display_name,
    r.contact_email,
    r.profile_picture,
    r.org_logo,
    r.club_affiliation,
    r.event_count,
    r.total_reviews,
    r.avg_rating,
    (select count(*) from ranked)::bigint as total_count
  from ranked r
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_event_directors(int, int) to anon, authenticated;
