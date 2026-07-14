-- ---------------------------------------------------------------------
-- Public directory views
--
-- Some public UI needs a few fields that live on `profiles`, whose RLS is
-- locked to self + admin (so the anon client can't read other users' rows).
-- Per the base-schema build notes ("Public directory data … should be served
-- through SECURITY DEFINER views … so RLS on profiles can stay locked"), we
-- expose ONLY the narrow, non-sensitive projections needed, through definer
-- views (the view owner bypasses RLS; `profiles` itself stays locked).
-- ---------------------------------------------------------------------

-- 1) Review-author badges — the badge on a published review
--    (Parent / Spectator · Coach · Team Manager · Event Director) is derived
--    from the AUTHOR's profile, for users who have at least one published review.
create or replace view public.review_author_badges as
  select distinct
    p.id,
    p.user_type,
    p.attendee_type
  from public.profiles p
  join public.reviews r
    on r.author_id = p.id
   and r.published = true;

grant select on public.review_author_badges to anon, authenticated;

-- 2) Event host logos — the organisation logo shown on an event card comes from
--    the event OWNER's profile (events.owner_id → profiles.org_logo). Exposed
--    per event id, for non-draft events whose owner has an org logo set.
create or replace view public.event_host_logos as
  select
    e.id as event_id,
    p.org_logo
  from public.events e
  join public.profiles p
    on p.id = e.owner_id
  where e.status <> 'draft'
    and p.org_logo is not null;

grant select on public.event_host_logos to anon, authenticated;

-- NOTE: intentionally NOT setting security_invoker=true on either view — we
-- want definer semantics so RLS on `profiles` stays locked while these narrow
-- projections are publicly readable.
