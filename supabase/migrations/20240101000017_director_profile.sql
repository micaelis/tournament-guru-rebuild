-- =====================================================================
-- Tournament Guru — Public director profile RPC
-- ---------------------------------------------------------------------
-- The Find Events cards now link the host org avatar/name to the public
-- director page (/directors/[id]). Profiles are locked to self+admin by
-- RLS, so we can't read another user's org info directly from the
-- authenticated client — this SECURITY DEFINER RPC exposes only the
-- fields Franco's June 18 mock lists (name, description, logo, guru
-- badge, aggregated ratings + counts). No emails, no auth internals.
-- =====================================================================

create or replace function public.get_director_profile(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
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
      and pr.user_type in ('event_director', 'admin')
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
    -- Split reviews on this director's events into coach vs attendee.
    -- Mirrors the split used elsewhere (user_role ilike '%coach%').
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
