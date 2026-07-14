-- ==========================================================================
-- Featured Events cleanup — PROPOSAL ONLY (run manually after review)
--
-- This is intentionally NOT placed in supabase/migrations/ and adds no schema
-- objects — it is data hygiene for the homepage "Find your next tournament"
-- (Featured Events) strip:
--   1) removes the placeholder "Test event" from the strip, and
--   2) seeds one realistic replacement featured event consistent with the rest.
--
-- Review, then run against the target database (staging first). Everything is
-- idempotent-ish and title-scoped so it is safe to re-read before running.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1) Remove the placeholder "Test event" from the Featured strip.
--    Preferred, non-destructive: unfeature it and move it out of public
--    listings (status 'draft' is already excluded everywhere on the site).
--    This preserves the row/audit trail rather than deleting data directly.
-- --------------------------------------------------------------------------
update events
set premium = false,
    status  = 'draft'
where lower(btrim(title)) = 'test event';

--    Alternative — hard delete, ONLY if the row is truly disposable. The join
--    tables (event_ages / event_genders / event_fields / event_competition_levels)
--    clear via ON DELETE CASCADE. Leave commented unless you mean it.
-- delete from events
-- where lower(btrim(title)) = 'test event';

-- --------------------------------------------------------------------------
-- 2) Seed one realistic replacement featured event.
--    Real-sounding name / organizer / Midwest location / near-term dates /
--    logo placeholder. general_rating & reviews are the same denormalized
--    display fields the other featured cards use (no review rows implied).
-- --------------------------------------------------------------------------
with new_event as (
  insert into events (
    title, host_club, event_director, description,
    logo, start_date, end_date, registration_deadline,
    status, premium, claimed,
    state, region, location_text,
    website, registration_link,
    general_rating, reviews, nr_teams_last_year
  )
  values (
    'Heartland Summer Classic 2026',
    'Sporting Kansas City Youth',
    'Sporting KC Youth Events',
    'Sporting Kansas City Youth invites boys and girls teams U9–U18 to the '
      || 'Heartland Summer Classic — three days of competitive brackets on '
      || 'championship turf, professional officiating, and a stay-to-play '
      || 'weekend the whole club will remember.',
    'https://placehold.co/320x320/eef2f7/0f172a?text=Heartland+Classic',
    date '2026-08-07', date '2026-08-09', date '2026-07-24',
    'open', true, true,
    'KS', 'II', 'Overland Park, KS 66214, USA',
    'https://example.com/heartland-classic',
    'https://example.com/heartland-classic/register',
    4.6, 18, 96
  )
  returning id
)
insert into event_ages (event_id, age)
select id, age
from new_event,
     unnest(array['u9','u10','u11','u12','u13','u14','u15','u16','u17','u18']::age_group[]) as age;

-- Genders / surfaces / competition levels for the seeded event.
with e as (select id from events where title = 'Heartland Summer Classic 2026' limit 1)
insert into event_genders (event_id, gender)
select e.id, g from e, unnest(array['boys','girls']::gender[]) as g;

with e as (select id from events where title = 'Heartland Summer Classic 2026' limit 1)
insert into event_fields (event_id, surface)
select e.id, s from e, unnest(array['turf','grass']::field_surface[]) as s;

with e as (select id from events where title = 'Heartland Summer Classic 2026' limit 1)
insert into event_competition_levels (event_id, level)
select e.id, l from e, unnest(array['upper','highest']::competition_level[]) as l;

commit;

-- --------------------------------------------------------------------------
-- Note: the app-side query (getFeaturedEvents in lib/supabase/queries.ts) now
-- also defensively excludes placeholder-titled or date-less rows, so even if a
-- stray "Test event" reappears it will not render in the Featured strip.
-- --------------------------------------------------------------------------
