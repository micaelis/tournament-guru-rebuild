-- =====================================================================
-- Seed demographic tags (age_group / gender / competition_level /
-- field_surface) + teams-last-year on existing published events so the
-- filter chip pills on the search-page EventCard actually render.
--
-- Background: EventCard reads its Age / Gender / Level / Surface / Teams
-- pills from four join tables (event_ages, event_genders,
-- event_competition_levels, event_fields) and events.nr_teams_last_year.
-- Migration 000010 refreshed dates for the demo but never wrote any
-- demographic rows, so every card currently shows only the CONCLUDED
-- pill. This migration rotates through 8 realistic recipes and applies
-- them across every non-draft event, deterministic by created_at
-- ordering so re-runs assign the same recipe to the same event.
--
-- Idempotent: guarded by NOT EXISTS on each join-table insert, so a
-- second run is a no-op. Safe to re-run any time.
--
-- Personal-repo scope: applied to whatever events exist today. On the
-- client repo the real Bubble import will replace this data outright.
-- =====================================================================

do $$
declare
  r         record;
  recipe_ix int;
  team_ct   int;
begin
  -- Deterministic ordering: oldest events first, tie-break on id. Row
  -- number modulo 8 picks the recipe, so event N always gets recipe N%8.
  for r in
    select id, row_number() over (order by created_at, id) as rn
    from events
    where status <> 'draft'
  loop
    recipe_ix := (r.rn - 1) % 8;
    team_ct   := 24 + ((r.rn - 1) % 6) * 12; -- 24, 36, 48, 60, 72, 84 …

    -- Backfill last-year team count when it's still null/0 — powers
    -- the "N teams" chip and the "Most teams" sort on /events.
    update events
    set nr_teams_last_year = team_ct
    where id = r.id
      and (nr_teams_last_year is null or nr_teams_last_year = 0);

    -- Ages, genders, levels, surfaces per recipe.
    if recipe_ix = 0 then
      -- Boys U10, upper, turf
      insert into event_ages    (event_id, age)     values (r.id, 'u10')      on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'boys')     on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'upper') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'turf')     on conflict do nothing;

    elsif recipe_ix = 1 then
      -- Girls U12, upper, grass
      insert into event_ages    (event_id, age)     values (r.id, 'u12')      on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'girls')    on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'upper') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'grass')    on conflict do nothing;

    elsif recipe_ix = 2 then
      -- Co-ed U11-U13, middle, turf + grass
      insert into event_ages    (event_id, age)     values (r.id, 'u11')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u12')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u13')      on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'both')     on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'middle') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'turf')     on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'grass')    on conflict do nothing;

    elsif recipe_ix = 3 then
      -- Boys U14-U16, highest, turf
      insert into event_ages    (event_id, age)     values (r.id, 'u14')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u15')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u16')      on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'boys')     on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'highest') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'turf')     on conflict do nothing;

    elsif recipe_ix = 4 then
      -- Girls U14-U16, upper, grass
      insert into event_ages    (event_id, age)     values (r.id, 'u14')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u15')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u16')      on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'girls')    on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'upper') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'grass')    on conflict do nothing;

    elsif recipe_ix = 5 then
      -- Co-ed U6-U8, lower, grass
      insert into event_ages    (event_id, age)     values (r.id, 'u6')       on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u7')       on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u8')       on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'both')     on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'lower') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'grass')    on conflict do nothing;

    elsif recipe_ix = 6 then
      -- Boys U17-U19, highest, turf
      insert into event_ages    (event_id, age)     values (r.id, 'u17')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u18')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u19')      on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'boys')     on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'highest') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'turf')     on conflict do nothing;

    else
      -- Girls U15-U17, upper, turf
      insert into event_ages    (event_id, age)     values (r.id, 'u15')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u16')      on conflict do nothing;
      insert into event_ages    (event_id, age)     values (r.id, 'u17')      on conflict do nothing;
      insert into event_genders (event_id, gender)  values (r.id, 'girls')    on conflict do nothing;
      insert into event_competition_levels (event_id, level)   values (r.id, 'upper') on conflict do nothing;
      insert into event_fields  (event_id, surface) values (r.id, 'turf')     on conflict do nothing;
    end if;
  end loop;
end $$;
