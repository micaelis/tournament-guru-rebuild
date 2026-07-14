-- =====================================================================
-- Tournament Guru — Schema v2 additions (performance + search)
-- Layer these on top of the base schema.sql.
-- Focus: (1) full FK/join indexes, (2) rating-recalc triggers,
--        (3) elastic full-text + fuzzy search on events.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS for search
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm;      -- fuzzy / partial / misspelling-tolerant matching
create extension if not exists unaccent;     -- accent-insensitive matching

-- ---------------------------------------------------------------------
-- 2. FOREIGN-KEY & JOIN INDEXES
-- Postgres does NOT auto-index FK columns. Every column we filter or
-- join on needs one. Join tables need the *second* column indexed too —
-- the composite PK only helps queries that lead with the first column.
-- ---------------------------------------------------------------------

-- events: hot filter/sort columns
create index if not exists idx_events_owner        on events(owner_id);
create index if not exists idx_events_profile      on events(event_profile_id);
create index if not exists idx_events_season       on events(season_id);
create index if not exists idx_events_created      on events(created_at desc);

-- join tables: index the reverse-direction column
create index if not exists idx_event_ages_age              on event_ages(age);
create index if not exists idx_event_genders_gender        on event_genders(gender);
create index if not exists idx_event_fields_surface        on event_fields(surface);
create index if not exists idx_event_features_feature      on event_features(feature);
create index if not exists idx_event_levels_level          on event_competition_levels(level);
create index if not exists idx_favorites_event             on favorites(event_id);
create index if not exists idx_recently_viewed_event       on recently_viewed(event_id);
create index if not exists idx_review_likes_profile        on review_likes(profile_id);
create index if not exists idx_event_age_groups_event      on event_age_groups(event_id);

-- reviews: recency + relationship access
create index if not exists idx_reviews_created      on reviews(created_at desc);
create index if not exists idx_reviews_event_owner  on reviews(event_owner_id);

-- comments: threading + recency
create index if not exists idx_comments_reply_to    on comments(reply_to_comment);
create index if not exists idx_comments_created      on comments(created_at desc);

-- notifications: the common query is "my unseen, newest first"
create index if not exists idx_notifications_recipient_created
  on notifications(recipient_id, created_at desc);

-- promo codes: lookup by code and by owner
create index if not exists idx_promo_codes_coach    on promo_codes(coach_id);
create index if not exists idx_promo_codes_event    on promo_codes(event_id);

-- profiles: directory-type filtering
create index if not exists idx_profiles_user_type   on profiles(user_type);

-- user_teams / age prefs reverse lookups
create index if not exists idx_user_teams_profile   on user_teams(profile_id);
create index if not exists idx_profile_age_prefs_profile on profile_age_prefs(profile_id);


-- ---------------------------------------------------------------------
-- 3. RATING RECALCULATION (replaces Bubble backend wf recalc_event_data)
-- Denormalized rating/count columns on events must stay in sync with
-- reviews. A trigger recomputes them whenever a published review changes.
-- Only PUBLISHED reviews count toward public ratings.
-- ---------------------------------------------------------------------
create or replace function recalc_event_ratings(target_event uuid)
returns void language plpgsql as $$
begin
  update events e set
    general_rating = coalesce((
      select round(avg(overall_rating)::numeric, 2)
      from reviews r where r.event_id = target_event and r.published), 0),
    coach_rating = coalesce((
      select round(avg(overall_rating)::numeric, 2)
      from reviews r where r.event_id = target_event and r.published
        and r.user_role ilike '%coach%'), 0),
    attendee_rating = coalesce((
      select round(avg(overall_rating)::numeric, 2)
      from reviews r where r.event_id = target_event and r.published
        and (r.user_role is null or r.user_role not ilike '%coach%')), 0),
    reviews = (
      select count(*) from reviews r
      where r.event_id = target_event and r.published)
  where e.id = target_event;
end; $$;

create or replace function trg_reviews_recalc() returns trigger
language plpgsql as $$
begin
  if (TG_OP = 'DELETE') then
    perform recalc_event_ratings(OLD.event_id);
    return OLD;
  else
    perform recalc_event_ratings(NEW.event_id);
    -- if a review moved between events, refresh the old one too
    if (TG_OP = 'UPDATE' and NEW.event_id is distinct from OLD.event_id) then
      perform recalc_event_ratings(OLD.event_id);
    end if;
    return NEW;
  end if;
end; $$;

drop trigger if exists t_reviews_recalc on reviews;
create trigger t_reviews_recalc
  after insert or update or delete on reviews
  for each row execute function trg_reviews_recalc();


-- ---------------------------------------------------------------------
-- 4. ELASTIC EVENT SEARCH
-- "Type NY / New York / Midwest / a club name / a director — match any
-- keyword anywhere in the event."
--
-- Strategy:
--   * A generated search_document text column concatenates every
--     searchable field PLUS human-readable expansions of coded values
--     (state code -> full state name, region numeral -> region name),
--     so "New York" matches an event stored as "NY".
--   * A tsvector (search_vector) over that document with a GIN index
--     gives fast full-text keyword search.
--   * pg_trgm GIN index on the document gives fuzzy / partial / typo-
--     tolerant matching that plain full-text misses.
--
-- The state/region expansion is stored on the row at write time via a
-- trigger (immutable generated columns can't do lookups), keeping the
-- search document self-maintaining.
-- ---------------------------------------------------------------------

-- lookup: 2-letter state -> full name (extend as coverage grows)
create table if not exists us_states (
  code text primary key,
  name text not null
);
insert into us_states(code,name) values
  ('CA','California'),('FL','Florida'),('IA','Iowa'),('IL','Illinois'),
  ('IN','Indiana'),('KS','Kansas'),('KY','Kentucky'),('MO','Missouri'),
  ('NE','Nebraska'),('OH','Ohio'),('TN','Tennessee'),('UT','Utah'),
  ('WI','Wisconsin'),('NY','New York'),('TX','Texas'),('NJ','New Jersey'),
  ('PA','Pennsylvania'),('GA','Georgia'),('NC','North Carolina'),
  ('MI','Michigan'),('AZ','Arizona'),('WA','Washington'),('CO','Colorado'),
  ('MA','Massachusetts'),('VA','Virginia'),('MN','Minnesota'),('OR','Oregon'),
  ('MD','Maryland'),('SC','South Carolina'),('AL','Alabama'),('LA','Louisiana'),
  ('OK','Oklahoma'),('CT','Connecticut'),('NV','Nevada'),('AR','Arkansas'),
  ('MS','Mississippi'),('KA','Kansas')
on conflict (code) do nothing;

-- lookup: region numeral -> descriptive names (adjust to TG's real regions)
create table if not exists regions (
  code text primary key,
  name text not null
);
insert into regions(code,name) values
  ('I','Region I East Northeast'),
  ('II','Region II Midwest Great Lakes'),
  ('III','Region III South Southeast'),
  ('IV','Region IV West')
on conflict (code) do nothing;

-- columns that hold the search document + vector
alter table events add column if not exists search_document text;
alter table events add column if not exists search_vector tsvector;

-- build the search document for one event
create or replace function build_event_search_document(e events)
returns text language plpgsql stable as $$
declare
  state_name text;
  region_name text;
  age_terms text;
begin
  select name into state_name from us_states where code = e.state;
  select name into region_name from regions where code = (e.region::text);

  -- pull related age/gender tags so "U12 boys" style queries hit
  select string_agg(distinct (a.age::text || ' ' || coalesce(g.gender::text,'')), ' ')
    into age_terms
  from (select age from event_ages where event_id = e.id) a
  full join (select gender from event_genders where event_id = e.id) g on true;

  return concat_ws(' ',
    e.title, e.tournament_title, e.event_title_abbrev,
    e.description, e.event_director, e.host_club,
    e.state, state_name,
    (e.region::text), region_name,
    e.location_text,
    e.website, e.registration_link,
    age_terms
  );
end; $$;

-- trigger keeps document + vector current on write
create or replace function trg_event_search() returns trigger
language plpgsql as $$
begin
  new.search_document := build_event_search_document(new);
  new.search_vector := to_tsvector('english', unaccent(coalesce(new.search_document,'')));
  return new;
end; $$;

drop trigger if exists t_event_search on events;
create trigger t_event_search
  before insert or update on events
  for each row execute function trg_event_search();

-- indexes powering the two search modes
create index if not exists idx_events_search_vector
  on events using gin(search_vector);                 -- full-text keyword
create index if not exists idx_events_search_trgm
  on events using gin(search_document gin_trgm_ops);  -- fuzzy / partial / typo

-- When related ages/genders change, refresh the parent event's document.
create or replace function trg_refresh_event_search_from_child()
returns trigger language plpgsql as $$
declare eid uuid;
begin
  eid := coalesce(new.event_id, old.event_id);
  update events set updated_at = now() where id = eid; -- fires t_event_search via before-update
  return null;
end; $$;

drop trigger if exists t_event_ages_search on event_ages;
create trigger t_event_ages_search
  after insert or update or delete on event_ages
  for each row execute function trg_refresh_event_search_from_child();

drop trigger if exists t_event_genders_search on event_genders;
create trigger t_event_genders_search
  after insert or update or delete on event_genders
  for each row execute function trg_refresh_event_search_from_child();

-- ---------------------------------------------------------------------
-- Example search query (for the app layer):
--
--   select *,
--     ts_rank(search_vector, plainto_tsquery('english', unaccent($1))) as rank,
--     similarity(search_document, $1) as sim
--   from events
--   where status <> 'draft'
--     and (
--       search_vector @@ plainto_tsquery('english', unaccent($1))
--       or search_document % $1                    -- trigram fuzzy fallback
--     )
--   order by rank desc, sim desc
--   limit 20;
--
-- $1 = raw user input ("New York", "midwest", "lou fusz", "u12 boys").
-- Full-text handles whole words + the expanded state/region names;
-- trigram catches partials and misspellings.
-- ---------------------------------------------------------------------
