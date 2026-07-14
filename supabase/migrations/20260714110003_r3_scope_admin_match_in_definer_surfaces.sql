-- =====================================================================
-- R3 — Scope the public DEFINER surfaces to event_director only
--
-- Hostile-review finding: `event_host_logos`, `get_director_profile`,
-- and `review_author_badges` all match `user_type='admin'` alongside
-- `event_director`. Any admin with an `org_logo` shows up on event
-- cards; any admin can be crawled through `/directors/<id>`; admins
-- who authored a review get `user_type='admin'` in the review badge
-- read.
--
-- These are DEFINER surfaces — they bypass profiles RLS by design —
-- so an over-broad match becomes a public exposure of internal admin
-- profile fields.
--
-- Fix: filter each surface to `user_type='event_director'`. Admin
-- accounts, if they ever host events themselves, should be modelled
-- with a proper director profile alongside their admin role (which
-- the app allows: user_type is one column, is_admin() is a helper
-- that grants privileges but doesn't preclude also being a director).
--
-- Also stop leaking `user_type='admin'` in `review_author_badges` by
-- coalescing admin authors to 'attendee' — the badge is a display
-- decoration, not an authorization signal.
-- =====================================================================

-- ── event_host_logos: only event directors' org_logos surface ──────
create or replace view public.event_host_logos as
  select
    e.id as event_id,
    p.org_logo
  from public.events e
  join public.profiles p
    on p.id = e.owner_id
  where e.status <> 'draft'
    and p.user_type = 'event_director'
    and p.org_logo is not null;

alter view public.event_host_logos set (security_invoker = false);
grant select on public.event_host_logos to anon, authenticated;

-- ── review_author_badges: coalesce admin authors to 'attendee' ─────
create or replace view public.review_author_badges as
  select distinct
    p.id,
    -- Any 'admin' user_type is displayed as 'attendee' in the public
    -- badge. Admins are not a public reviewer persona; this hides
    -- which reviewers are staff.
    case when p.user_type = 'admin' then 'attendee' else p.user_type end as user_type,
    p.attendee_type
  from public.profiles p
  join public.reviews r
    on r.author_id = p.id
   and r.published = true;

alter view public.review_author_badges set (security_invoker = false);
grant select on public.review_author_badges to anon, authenticated;

-- ── get_director_profile: only real event_directors are lookupable ─
create or replace function public.get_director_profile(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with p as (
    select
      pr.id,
      coalesce(nullif(trim(pr.full_name), ''), 'Event Director') as display_name,
      pr.org_logo,
      pr.org_description,
      pr.club_affiliation,
      pr.profile_picture,
      pr.guru_badge
    from public.profiles pr
    where pr.id = p_id
      and pr.user_type = 'event_director'
  ),
  ev as (
    select
      count(*) filter (where status = 'concluded' or (end_date is not null and end_date < current_date)) as completed_events,
      count(*) filter (where status = 'open') as open_events,
      count(*) as total_events
    from public.events e
    where e.owner_id = p_id
      and e.status <> 'draft'
  ),
  rv as (
    select
      round(avg(r.overall_rating) filter (where r.user_role ilike '%coach%')::numeric, 2) as coach_rating,
      count(*) filter (where r.user_role ilike '%coach%') as coach_reviews,
      round(avg(r.overall_rating) filter (where r.user_role is null or r.user_role not ilike '%coach%')::numeric, 2) as attendee_rating,
      count(*) filter (where r.user_role is null or r.user_role not ilike '%coach%') as attendee_reviews
    from public.reviews r
    join public.events e on e.id = r.event_id
    where e.owner_id = p_id
      and r.published = true
  )
  select json_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'org_logo', p.org_logo,
    'org_description', p.org_description,
    'club_affiliation', p.club_affiliation,
    'profile_picture', p.profile_picture,
    'guru_badge', p.guru_badge,
    'completed_events', coalesce(ev.completed_events, 0),
    'open_events', coalesce(ev.open_events, 0),
    'total_events', coalesce(ev.total_events, 0),
    'coach_rating', coalesce(rv.coach_rating, 0),
    'coach_reviews', coalesce(rv.coach_reviews, 0),
    'attendee_rating', coalesce(rv.attendee_rating, 0),
    'attendee_reviews', coalesce(rv.attendee_reviews, 0)
  )
  from p
  cross join ev
  cross join rv;
$$;

grant execute on function public.get_director_profile(uuid) to anon, authenticated;
