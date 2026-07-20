-- =====================================================================
-- Tournament Guru — consolidated schema (auto-generated).
--
-- DO NOT EDIT DIRECTLY. This file is produced by scripts/build-schema.sh
-- from supabase/migrations/. It is the concatenation of every migration
-- in chronological order. Running it against a fresh Postgres/Supabase
-- project bootstraps the app's final schema (tables, RLS policies,
-- triggers, RPCs with SET search_path, grants, indexes, seed data).
--
-- To regenerate:  bash scripts/build-schema.sh
-- To verify:      diff pg_dump output vs psql -f schema.sql on a fresh DB.
-- =====================================================================

-- ── 20260716000001_baseline.sql ──────────────────────────────────────────
-- =====================================================================
-- Tournament Guru — from-scratch schema (generated from SCHEMA-DESIGN.md v0.2)
-- Postgres 15+ / Supabase. Security patterns carried forward from the audit.
-- Sections: extensions · enums · tables · indexes · functions · triggers ·
--           RLS · grants (column allow-lists) · views · seed reference data
-- =====================================================================

-- Hosted Supabase installs extensions into the `extensions` schema and does
-- NOT put it on the default search_path, so unqualified `citext` / `pg_trgm`
-- refs below would fail at CREATE-time. Local dev's stack already keeps
-- extensions on the path so this is a no-op there.
set search_path = public, extensions, pg_temp;

-- ---------- Extensions ----------
-- On Supabase Cloud these live in the `extensions` schema; functions that use
-- them must include `extensions` in their search_path (see functions section).
create extension if not exists citext      with schema extensions;
create extension if not exists pg_trgm     with schema extensions;
create extension if not exists unaccent    with schema extensions;
-- gen_random_uuid() is built into pgcrypto/core (PG13+), no extension needed.

-- ---------- Enums ----------
create type user_type         as enum ('admin','event_director','attendee');
create type role_title        as enum ('event_director','event_admin','club_director','coach','parent_spectator','team_manager');
create type user_gender        as enum ('female','male');
create type team_gender        as enum ('boys','girls','both');
create type age_bracket        as enum ('U4','U5','U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','U20');
create type competition_level  as enum ('highest','upper','middle','lower','lowest');
create type distance_pref      as enum ('no_limit','miles_150','miles_300','miles_450');
create type event_lifecycle    as enum ('draft','active','canceled');
create type surface            as enum ('turf','grass');
create type event_region       as enum ('I','II','III','IV');
create type field_size         as enum ('5v5','6v6','7v7','8v8','9v9','10v10','11v11');
create type event_feature      as enum ('stay_to_play','restrooms','concessions','accessible','free_wifi','pet_friendly','free_parking','synthetic_turf');
create type review_status      as enum ('draft','published');
create type promo_status       as enum ('staged','sent','active','applied','void');
create type csv_status         as enum ('pending','approved','rejected');
create type claim_status       as enum ('pending','approved','declined');
create type flag_content_type  as enum ('review','comment');
create type flag_reason        as enum ('profanity','illicit','solicitation','other');
create type faq_audience       as enum ('attendee','event_director','both');

-- ---------- Reference tables ----------
create table us_states (
  code  char(2) primary key,
  name  text not null
);

create table regions (
  numeral event_region primary key,
  label   text not null
);

create table seasons (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,          -- e.g. '2028-2029'
  start_year int  not null unique,
  created_at timestamptz not null default now()
);

-- ---------- Identity ----------
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  user_type           user_type  not null,
  role_title          role_title not null,
  first_name          text,
  last_name           text,
  dob                 date,                       -- PII: never in public projection
  user_gender         user_gender,
  location_lat        double precision,
  location_lng        double precision,
  location_formatted  text,
  location_city       text,
  location_state_full text,
  location_state_abbr char(2),
  location_zip        text,
  location_place_id   text,
  distance_pref       distance_pref,
  organization_title  text,                       -- "Organization Title" (ED) / "Club Affiliation" (attendee)
  org_description     text,                        -- ED only
  org_logo_url        text,                        -- ED only
  profile_photo_url   text,
  blocked             boolean not null default false,
  onboarding_completed boolean not null default false,
  -- notification prefs, all default FALSE (no email without explicit consent)
  email_review_replies    boolean not null default false,
  inapp_review_replies    boolean not null default false,
  email_review_likes      boolean not null default false,
  inapp_review_likes      boolean not null default false,
  email_comment_replies   boolean not null default false,
  inapp_comment_replies   boolean not null default false,
  email_event_reviews     boolean not null default false,  -- ED
  inapp_event_reviews     boolean not null default false,  -- ED
  email_favorited_events  boolean not null default false,  -- ED
  inapp_favorited_events  boolean not null default false,  -- ED
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint role_matches_type check (
    (user_type = 'admin')
    or (user_type = 'event_director' and role_title in ('event_director','event_admin','club_director'))
    or (user_type = 'attendee'       and role_title in ('coach','parent_spectator','team_manager'))
  )
);

create table user_teams (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references profiles(id) on delete cascade,
  slot              smallint not null check (slot between 1 and 3),
  team_gender       team_gender,
  age               age_bracket,
  competition_level competition_level,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (profile_id, slot)
);

-- ---------- Tournaments & events ----------
create table tournaments (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references profiles(id) on delete set null,   -- null/admin = claimable
  created_by    uuid references profiles(id) on delete set null,
  title         text not null,
  recurring     boolean not null default false,                    -- stored no-op (informational)
  claimed       boolean not null default false,
  -- denormalized aggregates (maintained by recalc trigger), rolled up from child events
  general_rating   numeric(3,2),
  coach_rating     numeric(3,2),
  attendee_rating  numeric(3,2),
  review_count     integer not null default 0,
  avg_fields       numeric(3,2),
  avg_facilities   numeric(3,2),
  avg_management   numeric(3,2),
  avg_competition  numeric(3,2),
  avg_diversity    numeric(3,2),
  avg_cost_value   numeric(3,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table events (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references tournaments(id) on delete cascade,
  owner_id            uuid references profiles(id) on delete set null,
  created_by          uuid references profiles(id) on delete set null,
  claimed             boolean not null default false,
  logo_url            text,
  title               text not null,
  website_url         text,
  host_club           text,
  start_date          date,
  end_date            date,
  registration_deadline date,
  description         text,
  location_lat        double precision,
  location_lng        double precision,
  location_formatted  text,
  location_city       text,
  location_state_full text,
  location_state_abbr char(2),
  location_zip        text,
  location_place_id   text,
  num_teams_this_year integer,
  region              event_region,
  season_id           uuid references seasons(id) on delete set null,
  lifecycle           event_lifecycle not null default 'draft',
  cancel_reason       text,
  is_premium          boolean not null default false,
  is_sponsored        boolean not null default false,
  premium_at          timestamptz,
  video_url           text,                          -- premium
  teams_this_year_url text,                          -- premium
  teams_prev_year_url text,                          -- premium
  registration_url    text,                          -- premium
  teams_attended_prev_year integer,                  -- premium
  would_return_pct    numeric(5,2),                  -- % all coach+manager reviews answering true
  -- denormalized aggregates (recalc trigger)
  general_rating   numeric(3,2),
  coach_rating     numeric(3,2),
  attendee_rating  numeric(3,2),
  review_count     integer not null default 0,
  avg_fields       numeric(3,2),
  avg_facilities   numeric(3,2),
  avg_management   numeric(3,2),
  avg_competition  numeric(3,2),
  avg_diversity    numeric(3,2),
  avg_cost_value   numeric(3,2),
  search_document text,
  search_vector   tsvector,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint end_after_start check (end_date is null or start_date is null or end_date >= start_date)
);

create table event_age_groups (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  team_gender team_gender not null,
  age         age_bracket not null,
  price       integer not null,
  field_size  field_size not null,
  created_at  timestamptz not null default now()
);

create table event_competition_levels (
  event_id uuid not null references events(id) on delete cascade,
  level    competition_level not null,
  primary key (event_id, level)
);

create table event_surfaces (
  event_id uuid not null references events(id) on delete cascade,
  surface  surface not null,
  primary key (event_id, surface)
);

create table event_features (
  event_id uuid not null references events(id) on delete cascade,
  feature  event_feature not null,
  primary key (event_id, feature)
);

create table event_images (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  url        text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table event_milestones (            -- Key Dates & Deadlines (premium)
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  milestone_date date,
  title         text not null,
  description   text,
  sort_order    smallint not null default 0,
  is_auto       boolean not null default false,   -- the 2 auto-created (Early-Bird Ends, Registration Deadline)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table sponsors (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  name       text not null,
  link       text not null,
  logo_url   text not null,
  created_at timestamptz not null default now()
);

-- ---------- Reviews & engagement ----------
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references events(id) on delete set null,   -- nulled on event delete (detach)
  author_id      uuid references profiles(id) on delete set null, -- nulled on account anonymize
  status         review_status not null default 'draft',
  rating_fields      smallint check (rating_fields      between 1 and 5),
  rating_facilities  smallint check (rating_facilities  between 1 and 5),
  rating_management  smallint check (rating_management  between 1 and 5),
  rating_competition smallint check (rating_competition between 1 and 5),
  rating_diversity   smallint check (rating_diversity   between 1 and 5),
  rating_cost_value  smallint check (rating_cost_value  between 1 and 5),
  overall        numeric(3,2),                    -- computed avg of non-null categories
  review_title   text,
  review_body    text,                            -- rich text, server-sanitized
  would_return   boolean,                         -- coach/manager question
  guru_review    boolean not null default false,  -- server-set only (promo apply)
  promo_id       uuid,                            -- FK added after promo_codes (below)
  helpful_count  integer not null default 0,
  published_at   timestamptz,
  reviewer_user_type user_type,                   -- snapshot, kept after anonymize
  reviewer_role      role_title,                  -- snapshot, kept after anonymize
  anonymized     boolean not null default false,
  detached       boolean not null default false,
  snapshot_event_title      text,
  snapshot_tournament_title text,
  snapshot_event_start      date,
  snapshot_event_end        date,
  snapshot_event_location   text,
  snapshot_event_logo       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- one review per (author, event); anonymized rows (author null) excluded
create unique index reviews_one_per_author_event on reviews(author_id, event_id)
  where author_id is not null and event_id is not null;

create table comments (
  id                uuid primary key default gen_random_uuid(),
  review_id         uuid not null references reviews(id) on delete cascade,
  author_id         uuid references profiles(id) on delete set null,
  parent_comment_id uuid references comments(id) on delete cascade,
  body              text not null,                -- rich text, sanitized + banned-word checked
  is_owner_reply    boolean not null default false,
  anonymized        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table review_helpful (
  user_id   uuid not null references profiles(id) on delete cascade,
  review_id uuid not null references reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

create table content_hidden (              -- per-user permanent hide after flagging
  user_id      uuid not null references profiles(id) on delete cascade,
  content_type flag_content_type not null,
  content_id   uuid not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, content_type, content_id)
);

create table flagged_content (
  id              uuid primary key default gen_random_uuid(),
  content_type    flag_content_type not null,
  content_id      uuid not null,
  flagged_by      uuid references profiles(id) on delete set null,
  reason          flag_reason not null,
  additional_info text,                          -- required if reason = 'other' (app-enforced)
  created_at      timestamptz not null default now()
);

-- ---------- Promo system ----------
create table submitted_csvs (
  id              uuid primary key default gen_random_uuid(),
  ed_id           uuid not null references profiles(id) on delete cascade,
  event_id        uuid not null references events(id) on delete cascade,
  file_path       text not null,                 -- private bucket; signed-URL download only
  status          csv_status not null default 'pending',
  rejection_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table promo_codes (
  id               uuid primary key default gen_random_uuid(),
  submitted_csv_id uuid not null references submitted_csvs(id) on delete cascade,
  event_id         uuid not null references events(id) on delete cascade,
  email            citext not null,
  pretty_code      text not null,                -- 8-char alnum, display/copy only
  url_token        text unique,                  -- nanoid, unguessable ?promo= token
  user_id          uuid references profiles(id) on delete set null,
  status           promo_status not null default 'staged',
  applied_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- one non-void promo per (email, event)
create unique index promo_one_active_per_email_event on promo_codes(email, event_id)
  where status <> 'void';

-- reviews.promo_id FK (deferred until promo_codes exists)
alter table reviews add constraint reviews_promo_fk
  foreign key (promo_id) references promo_codes(id) on delete set null;

create table promo_funnel_events (         -- collected, not surfaced in sprint 1
  id         uuid primary key default gen_random_uuid(),
  promo_id   uuid not null references promo_codes(id) on delete cascade,
  step       text not null,                -- landed | step1 | step2 | step3 | applied
  occurred_at timestamptz not null default now()
);

-- ---------- Claim ----------
create table claim_requests (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  event_id       uuid references events(id) on delete set null,
  requester_id   uuid not null references profiles(id) on delete cascade,
  status         claim_status not null default 'pending',
  phone          text not null,
  links          text[] not null default '{}',
  message        text,
  decline_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- one pending request per (requester, tournament)
create unique index claim_one_pending_per_requester_tournament
  on claim_requests(requester_id, tournament_id) where status = 'pending';

-- ---------- Favorites & activity ----------
create table favorites (
  user_id    uuid not null references profiles(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table recently_viewed (
  user_id   uuid not null references profiles(id) on delete cascade,
  event_id  uuid not null references events(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ---------- Admin / reference / infra ----------
create table banned_words (
  id         uuid primary key default gen_random_uuid(),
  word       citext not null unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table faqs (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  audience   faq_audience not null default 'both',
  sort_order smallint not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table demo_reviews (                -- landing "Recent Reviews" (dummy, never real PII)
  id            uuid primary key default gen_random_uuid(),
  reviewer_name text not null,
  reviewer_role text,
  event_title   text,
  review_title  text,
  review_body   text,
  overall       numeric(3,2),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

create table search_queries (
  id         uuid primary key default gen_random_uuid(),
  term       text not null,
  created_at timestamptz not null default now()
);

create table support_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete set null,
  name       text not null,
  email      citext not null,
  message    text not null,
  created_at timestamptz not null default now()
);

create table contact_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      citext not null,
  message    text not null,
  source     text,
  created_at timestamptz not null default now()
);

create table platform_counters (           -- durable counters (deleted reviews still count)
  key   text primary key,                  -- published_reviews_total | listed_tournaments_total | listed_events_total
  value bigint not null default 0
);

create table rate_limit_windows (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

-- ---------- Billing (DEFERRED sprint 1) ----------
create table cards (                        -- Stripe tokens/metadata ONLY, never PAN/CVV
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_pm_id       text,
  brand              text,
  last4              char(4),
  exp_month          smallint,
  exp_year           smallint,
  is_default         boolean not null default false,
  created_at         timestamptz not null default now()
);

create table transactions (                 -- parked
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete set null,
  event_id   uuid references events(id) on delete set null,
  amount     integer,
  kind       text,
  created_at timestamptz not null default now()
);

create table notifications (                -- hidden sprint 1
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,
  payload    jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Indexes
-- =====================================================================
create index idx_events_tournament   on events(tournament_id);
create index idx_events_owner         on events(owner_id);
create index idx_events_lifecycle     on events(lifecycle);
create index idx_events_dates         on events(start_date, end_date);
create index idx_events_state         on events(location_state_abbr);
create index idx_events_flags         on events(is_premium, is_sponsored);
create index idx_events_search_vector on events using gin(search_vector);
create index idx_events_search_trgm   on events using gin(search_document extensions.gin_trgm_ops);
create index idx_age_groups_event     on event_age_groups(event_id);
create index idx_sponsors_event       on sponsors(event_id);
create index idx_reviews_event        on reviews(event_id);
create index idx_reviews_author       on reviews(author_id);
create index idx_reviews_status       on reviews(status);
create index idx_comments_review      on comments(review_id);
create index idx_comments_parent      on comments(parent_comment_id);
create index idx_flagged_content      on flagged_content(content_type, content_id);
create index idx_promo_csv            on promo_codes(submitted_csv_id);
create index idx_promo_event          on promo_codes(event_id);
create index idx_promo_user           on promo_codes(user_id);
create index idx_claim_tournament     on claim_requests(tournament_id);
create index idx_favorites_event      on favorites(event_id);
create index idx_recent_user_time     on recently_viewed(user_id, viewed_at desc);

-- =====================================================================
-- Functions
-- =====================================================================

-- is_admin(): the linchpin. Definer so it can read profiles regardless of caller RLS.
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from profiles where id = auth.uid() and user_type = 'admin');
$$;

-- generic updated_at
create or replace function touch_updated_at() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

-- auto-create profile row on signup
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into profiles (id, user_type, role_title, first_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'user_type')::user_type, 'attendee'),
    coalesce((new.raw_user_meta_data->>'role_title')::role_title, 'coach'),
    new.raw_user_meta_data->>'first_name'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- display status derived from dates (never stored stale)
create or replace function event_display_status(e events) returns text
  language sql stable set search_path = public, pg_temp as $$
  select case
    when e.lifecycle = 'draft'    then 'Draft'
    when e.lifecycle = 'canceled' then 'Canceled'
    when e.end_date   < current_date then 'Concluded'
    when e.start_date > current_date then 'Upcoming'
    else 'Ongoing'
  end;
$$;

-- NULL-aware average of a review's category scores
create or replace function review_overall(r reviews) returns numeric
  language sql immutable set search_path = public, pg_temp as $$
  select round(avg(v), 2) from (values
    (r.rating_fields),(r.rating_facilities),(r.rating_management),
    (r.rating_competition),(r.rating_diversity),(r.rating_cost_value)
  ) as t(v) where v is not null;
$$;

-- recompute an event's denormalized aggregates from PUBLISHED reviews, then roll up
create or replace function recalc_event_ratings(target_event uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare t_id uuid;
begin
  update events e set
    review_count    = s.cnt,
    general_rating  = s.overall,
    coach_rating    = s.coach,
    attendee_rating = s.attendee,
    avg_fields      = s.f, avg_facilities = s.fa, avg_management = s.m,
    avg_competition = s.c, avg_diversity  = s.d,  avg_cost_value = s.cv,
    would_return_pct = s.wr
  from (
    select
      count(*) filter (where status='published')                         as cnt,
      round(avg(overall) filter (where status='published'),2)            as overall,
      round(avg(overall) filter (where status='published' and reviewer_role='coach'),2)                       as coach,
      round(avg(overall) filter (where status='published' and reviewer_role<>'coach'),2)                      as attendee,
      round(avg(rating_fields)      filter (where status='published'),2) as f,
      round(avg(rating_facilities)  filter (where status='published'),2) as fa,
      round(avg(rating_management)  filter (where status='published'),2) as m,
      round(avg(rating_competition) filter (where status='published'),2) as c,
      round(avg(rating_diversity)   filter (where status='published'),2) as d,
      round(avg(rating_cost_value)  filter (where status='published'),2) as cv,
      round(100.0 * count(*) filter (where status='published' and reviewer_role in ('coach','team_manager') and would_return)
            / nullif(count(*) filter (where status='published' and reviewer_role in ('coach','team_manager') and would_return is not null),0), 2) as wr
    from reviews where event_id = target_event
  ) s
  where e.id = target_event;

  select tournament_id into t_id from events where id = target_event;
  if t_id is not null then perform recalc_tournament_ratings(t_id); end if;
end; $$;

create or replace function recalc_tournament_ratings(target_tournament uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update tournaments t set
    review_count    = coalesce(s.cnt,0),
    general_rating  = s.overall, coach_rating = s.coach, attendee_rating = s.attendee,
    avg_fields = s.f, avg_facilities = s.fa, avg_management = s.m,
    avg_competition = s.c, avg_diversity = s.d, avg_cost_value = s.cv
  from (
    select
      count(*) filter (where r.status='published') as cnt,
      round(avg(r.overall) filter (where r.status='published'),2) as overall,
      round(avg(r.overall) filter (where r.status='published' and r.reviewer_role='coach'),2)  as coach,
      round(avg(r.overall) filter (where r.status='published' and r.reviewer_role<>'coach'),2) as attendee,
      round(avg(r.rating_fields)      filter (where r.status='published'),2) as f,
      round(avg(r.rating_facilities)  filter (where r.status='published'),2) as fa,
      round(avg(r.rating_management)  filter (where r.status='published'),2) as m,
      round(avg(r.rating_competition) filter (where r.status='published'),2) as c,
      round(avg(r.rating_diversity)   filter (where r.status='published'),2) as d,
      round(avg(r.rating_cost_value)  filter (where r.status='published'),2) as cv
    from reviews r join events e on e.id = r.event_id
    where e.tournament_id = target_tournament
  ) s
  where t.id = target_tournament;
end; $$;

-- review write trigger: keep overall in sync + recalc aggregates + counters
create or replace function trg_reviews_write() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    new.overall = review_overall(new);
    -- durable published counter: increment on the draft->published transition
    if tg_op='INSERT' and new.status='published' then
      update platform_counters set value=value+1 where key='published_reviews_total';
    elsif tg_op='UPDATE' and old.status<>'published' and new.status='published' then
      update platform_counters set value=value+1 where key='published_reviews_total';
    end if;
    return new;
  end if;
  return old;
end; $$;

create or replace function trg_reviews_recalc() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op='DELETE' then
    if old.event_id is not null then perform recalc_event_ratings(old.event_id); end if;
    return old;
  end if;
  if new.event_id is not null then perform recalc_event_ratings(new.event_id); end if;
  if tg_op='UPDATE' and old.event_id is distinct from new.event_id and old.event_id is not null then
    perform recalc_event_ratings(old.event_id);
  end if;
  return new;
end; $$;

-- helpful_count maintenance
create or replace function trg_helpful_count() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op='INSERT' then update reviews set helpful_count=helpful_count+1 where id=new.review_id; return new; end if;
  update reviews set helpful_count=greatest(helpful_count-1,0) where id=old.review_id; return old;
end; $$;

-- search document builder (expands state/region so "NY" matches "New York")
create or replace function build_event_search_document(e events) returns text
  language sql stable set search_path = public, extensions, pg_temp as $$
  select concat_ws(' ',
    e.title, e.host_club, e.description, e.location_city,
    e.location_state_abbr, e.location_state_full, e.location_zip,
    (select name from us_states where code = e.location_state_abbr),
    e.region::text
  );
$$;

create or replace function trg_event_search() returns trigger
  language plpgsql set search_path = public, extensions, pg_temp as $$
begin
  new.search_document = build_event_search_document(new);
  new.search_vector   = to_tsvector('english', coalesce(new.search_document,''));
  return new;
end; $$;

-- rate limiting (carry-forward): global per-minute burst cap
create or replace function rate_limit_touch(p_bucket text, p_limit int) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare cur int; win timestamptz := date_trunc('minute', now());
begin
  if p_bucket not in ('search_queries','contact_requests','support_messages','password_reset') then
    raise exception 'unknown bucket' using errcode='22023';
  end if;
  if p_limit < 1 or p_limit > 100000 then
    raise exception 'bad limit' using errcode='22023';
  end if;
  insert into rate_limit_windows(bucket,window_start,hits) values (p_bucket,win,1)
    on conflict (bucket,window_start) do update set hits = rate_limit_windows.hits+1
    returning hits into cur;
  if cur > p_limit then raise exception 'rate limit exceeded' using errcode='22023'; end if;
end; $$;

create or replace function rate_limit_prune() returns void
  language sql security definer set search_path = public, pg_temp as $$
  delete from rate_limit_windows where window_start < now() - interval '1 hour';
$$;

create or replace function trg_search_queries_rate_limit() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin perform rate_limit_touch('search_queries', 1000); return new; end; $$;

create or replace function trg_contact_requests_rate_limit() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin perform rate_limit_touch('contact_requests', 60); return new; end; $$;

-- popular searches (mode picks most-typed casing)
create or replace function get_popular_searches(p_limit int default 8, p_days int default 30)
  returns table(term text, hits bigint)
  language sql stable security definer set search_path = public, pg_temp as $$
  select mode() within group (order by btrim(term)) as term, count(*) as hits
  from search_queries
  where created_at > now() - make_interval(days => p_days)
  group by lower(btrim(term)) order by hits desc limit p_limit;
$$;

-- homepage stats from durable counters (one round trip)
create or replace function get_platform_stats()
  returns table(reviews bigint, events bigint, tournaments bigint)
  language sql stable security definer set search_path = public, pg_temp as $$
  select
    (select value from platform_counters where key='published_reviews_total'),
    (select value from platform_counters where key='listed_events_total'),
    (select value from platform_counters where key='listed_tournaments_total');
$$;

-- ---------- Deletion / anonymization (atomic, definer) ----------

-- Event deletion: detach its reviews/comments (snapshot the event), keep reviewer identity.
create or replace function delete_event(target_event uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare t_id uuid;
begin
  select tournament_id into t_id from events where id = target_event;
  update reviews r set
    detached = true, event_id = null,
    snapshot_event_title      = e.title,
    snapshot_tournament_title = tr.title,
    snapshot_event_start      = e.start_date,
    snapshot_event_end        = e.end_date,
    snapshot_event_location   = e.location_formatted,
    snapshot_event_logo       = e.logo_url
  from events e left join tournaments tr on tr.id = e.tournament_id
  where r.event_id = target_event and e.id = target_event;
  delete from events where id = target_event;             -- cascades child data
  if t_id is not null then perform recalc_tournament_ratings(t_id); end if;
end; $$;

create or replace function delete_tournament(target_tournament uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare ev uuid;
begin
  for ev in select id from events where tournament_id = target_tournament loop
    perform delete_event(ev);
  end loop;
  delete from tournaments where id = target_tournament;
end; $$;

-- Attendee account deletion: anonymize their reviews/comments (destroy identity, keep content).
create or replace function anonymize_account(target_user uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update reviews set anonymized = true, author_id = null where author_id = target_user;
  update comments set anonymized = true, author_id = null where author_id = target_user;
end; $$;

-- Apply a promo to a review at publish (atomic): set guru, mark promo applied, void siblings.
create or replace function apply_promo_to_review(p_review uuid, p_promo uuid) returns void
  language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_event uuid; v_email citext;
begin
  select event_id, email into v_event, v_email from promo_codes where id = p_promo;
  update reviews set guru_review = true, promo_id = p_promo where id = p_review;
  update promo_codes set status='applied', applied_at=now() where id = p_promo;
  update promo_codes set status='void'
    where email = v_email and event_id = v_event and id <> p_promo and status <> 'applied';
end; $$;

-- =====================================================================
-- Triggers
-- =====================================================================
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create trigger t_profiles_touch      before update on profiles      for each row execute function touch_updated_at();
create trigger t_user_teams_touch    before update on user_teams    for each row execute function touch_updated_at();
create trigger t_tournaments_touch   before update on tournaments   for each row execute function touch_updated_at();
create trigger t_events_touch        before update on events        for each row execute function touch_updated_at();
create trigger t_reviews_touch       before update on reviews       for each row execute function touch_updated_at();
create trigger t_comments_touch      before update on comments      for each row execute function touch_updated_at();
create trigger t_milestones_touch    before update on event_milestones for each row execute function touch_updated_at();
create trigger t_csv_touch           before update on submitted_csvs for each row execute function touch_updated_at();
create trigger t_promo_touch         before update on promo_codes   for each row execute function touch_updated_at();
create trigger t_claim_touch         before update on claim_requests for each row execute function touch_updated_at();
create trigger t_faqs_touch          before update on faqs          for each row execute function touch_updated_at();

create trigger t_events_search       before insert or update on events for each row execute function trg_event_search();

create trigger t_reviews_write       before insert or update on reviews for each row execute function trg_reviews_write();
create trigger t_reviews_recalc      after  insert or update or delete on reviews for each row execute function trg_reviews_recalc();
create trigger t_review_helpful      after  insert or delete on review_helpful for each row execute function trg_helpful_count();

create trigger t_search_rl           before insert on search_queries   for each row execute function trg_search_queries_rate_limit();
create trigger t_contact_rl          before insert on contact_requests for each row execute function trg_contact_requests_rate_limit();

-- =====================================================================
-- RLS
-- =====================================================================
alter table profiles              enable row level security;
alter table user_teams            enable row level security;
alter table tournaments           enable row level security;
alter table events                enable row level security;
alter table event_age_groups      enable row level security;
alter table event_competition_levels enable row level security;
alter table event_surfaces        enable row level security;
alter table event_features        enable row level security;
alter table event_images          enable row level security;
alter table event_milestones      enable row level security;
alter table sponsors              enable row level security;
alter table reviews               enable row level security;
alter table comments              enable row level security;
alter table review_helpful        enable row level security;
alter table content_hidden        enable row level security;
alter table flagged_content       enable row level security;
alter table submitted_csvs        enable row level security;
alter table promo_codes           enable row level security;
alter table promo_funnel_events   enable row level security;
alter table claim_requests        enable row level security;
alter table favorites             enable row level security;
alter table recently_viewed       enable row level security;
alter table banned_words          enable row level security;
alter table faqs                  enable row level security;
alter table demo_reviews          enable row level security;
alter table search_queries        enable row level security;
alter table support_messages      enable row level security;
alter table contact_requests      enable row level security;
alter table platform_counters     enable row level security;
alter table rate_limit_windows    enable row level security;
alter table cards                 enable row level security;
alter table transactions          enable row level security;
alter table notifications         enable row level security;
alter table seasons               enable row level security;
alter table us_states             enable row level security;
alter table regions               enable row level security;

-- helper predicate: is this event publicly visible?
-- (published/active + not draft) OR owned OR admin
-- profiles: self + admin
create policy p_profiles_self_read   on profiles for select using (auth.uid() = id or is_admin());
create policy p_profiles_self_update on profiles for update using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());
-- (public director/reviewer info is exposed via definer views, not direct table read)

create policy p_user_teams_self on user_teams for all
  using (profile_id = auth.uid() or is_admin()) with check (profile_id = auth.uid() or is_admin());

-- tournaments/events: public read of non-draft; owner/admin write
create policy p_tournaments_read on tournaments for select
  using (true);  -- tournament rows are non-sensitive; event visibility gates content
create policy p_tournaments_write on tournaments for all
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());

create policy p_events_read on events for select
  using (lifecycle <> 'draft' or owner_id = auth.uid() or is_admin());
create policy p_events_write on events for all
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());

-- event child tables: read follows parent, write scoped to owner/admin
do $$
declare tbl text;
begin
  foreach tbl in array array['event_age_groups','event_competition_levels','event_surfaces',
                             'event_features','event_images','event_milestones','sponsors']
  loop
    execute format($f$
      create policy p_%1$s_read on %1$s for select using (
        exists (select 1 from events e where e.id = %1$s.event_id
                and (e.lifecycle <> 'draft' or e.owner_id = auth.uid() or is_admin())));
      create policy p_%1$s_write on %1$s for all using (
        exists (select 1 from events e where e.id = %1$s.event_id
                and (e.owner_id = auth.uid() or is_admin())))
      with check (
        exists (select 1 from events e where e.id = %1$s.event_id
                and (e.owner_id = auth.uid() or is_admin())));
    $f$, tbl);
  end loop;
end $$;

-- reviews: public read of published (not hidden by this user); author manages own draft
create policy p_reviews_read on reviews for select using (
  (status='published'
    and not exists (select 1 from content_hidden h
                    where h.user_id=auth.uid() and h.content_type='review' and h.content_id=reviews.id))
  or author_id = auth.uid() or is_admin());
create policy p_reviews_insert on reviews for insert with check (author_id = auth.uid());
create policy p_reviews_update on reviews for update
  using (author_id = auth.uid() or is_admin()) with check (author_id = auth.uid() or is_admin());
create policy p_reviews_delete on reviews for delete using (author_id = auth.uid() or is_admin());

-- comments: public read; attendees (not the review author) + owner-ED reply; author manages own
create policy p_comments_read on comments for select using (
  not exists (select 1 from content_hidden h
              where h.user_id=auth.uid() and h.content_type='comment' and h.content_id=comments.id)
  or is_admin());
create policy p_comments_insert on comments for insert with check (author_id = auth.uid());
create policy p_comments_update on comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy p_comments_delete on comments for delete using (author_id = auth.uid() or is_admin());

create policy p_helpful_self on review_helpful for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_hidden_self on content_hidden for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy p_flag_insert on flagged_content for insert with check (flagged_by = auth.uid());
create policy p_flag_admin  on flagged_content for select using (is_admin());
create policy p_flag_delete on flagged_content for delete using (is_admin());

-- promo / csv: ED owns theirs, admin all
create policy p_csv_rw on submitted_csvs for all
  using (ed_id = auth.uid() or is_admin()) with check (ed_id = auth.uid() or is_admin());
create policy p_promo_read on promo_codes for select
  using (user_id = auth.uid() or is_admin()
         or exists (select 1 from submitted_csvs c where c.id = promo_codes.submitted_csv_id and c.ed_id = auth.uid()));
create policy p_promo_admin_write on promo_codes for all using (is_admin()) with check (is_admin());
create policy p_funnel_admin on promo_funnel_events for all using (is_admin()) with check (is_admin());

-- claims: requester + admin read; requester insert; admin decision
create policy p_claim_read on claim_requests for select using (requester_id = auth.uid() or is_admin());
create policy p_claim_insert on claim_requests for insert with check (requester_id = auth.uid());
create policy p_claim_admin on claim_requests for update using (is_admin()) with check (is_admin());

create policy p_favorites_self on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_recent_self    on recently_viewed for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reference / public-read tables
create policy p_us_states_read on us_states for select using (true);
create policy p_regions_read   on regions   for select using (true);
create policy p_seasons_read   on seasons   for select using (true);
create policy p_faqs_read      on faqs      for select using (true);
create policy p_faqs_admin     on faqs      for all using (is_admin()) with check (is_admin());
create policy p_demo_read      on demo_reviews for select using (true);
create policy p_banned_admin   on banned_words for all using (is_admin()) with check (is_admin());

-- public write endpoints (rate-limited by trigger)
create policy p_search_insert  on search_queries   for insert with check (true);
create policy p_contact_insert on contact_requests for insert with check (true);
create policy p_support_insert on support_messages for insert with check (auth.uid() is not null);
create policy p_support_admin  on support_messages for select using (is_admin());

-- self-owned sensitive
create policy p_cards_self on cards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_notifications_self on notifications for select using (user_id = auth.uid());
create policy p_transactions_self on transactions for select using (user_id = auth.uid() or is_admin());
-- platform_counters, rate_limit_windows: no policies (definer/service_role only)

-- =====================================================================
-- Column-grant allow-lists (privilege-escalation cap — checked before RLS)
-- =====================================================================
revoke update on profiles from authenticated;
grant  update (first_name, last_name, user_gender,
               location_lat, location_lng, location_formatted, location_city,
               location_state_full, location_state_abbr, location_zip, location_place_id,
               distance_pref, organization_title, org_description, org_logo_url, profile_photo_url,
               onboarding_completed,
               email_review_replies, inapp_review_replies, email_review_likes, inapp_review_likes,
               email_comment_replies, inapp_comment_replies, email_event_reviews, inapp_event_reviews,
               email_favorited_events, inapp_favorited_events, updated_at)
  on profiles to authenticated;   -- omits user_type, role_title, dob, blocked

revoke insert on reviews from authenticated;
grant  insert (event_id, author_id, status, rating_fields, rating_facilities, rating_management,
               rating_competition, rating_diversity, rating_cost_value, review_title, review_body,
               would_return, reviewer_user_type, reviewer_role)
  on reviews to authenticated;    -- omits guru_review, promo_id, published_at, anonymized, detached, snapshots
revoke update on reviews from authenticated;
grant  update (status, rating_fields, rating_facilities, rating_management, rating_competition,
               rating_diversity, rating_cost_value, review_title, review_body, would_return, updated_at)
  on reviews to authenticated;

-- =====================================================================
-- Public projection views (definer semantics; never expose PII)
-- =====================================================================
create view public_directors with (security_invoker = false) as
  select id, first_name, last_name, organization_title, org_logo_url, org_description, profile_photo_url
  from profiles where user_type = 'event_director';   -- NO email, NO dob

create view review_author_public with (security_invoker = false) as
  select r.id as review_id,
         case when r.anonymized then null else p.first_name end as first_name,
         case when r.anonymized then null else p.profile_photo_url end as photo,
         r.reviewer_role, r.guru_review
  from reviews r left join profiles p on p.id = r.author_id;

grant select on public_directors, review_author_public to anon, authenticated;
grant execute on function get_platform_stats(), get_popular_searches(int,int) to anon, authenticated;
-- rate_limit_touch is NOT granted to anon/authenticated (definer triggers call it internally)
revoke execute on function rate_limit_touch(text,int) from public, anon, authenticated;

-- =====================================================================
-- Seed reference data
-- =====================================================================
insert into platform_counters(key,value) values
  ('published_reviews_total',0),('listed_events_total',0),('listed_tournaments_total',0);

insert into regions(numeral,label) values ('I','Region I'),('II','Region II'),('III','Region III'),('IV','Region IV');

insert into seasons(label,start_year) values
  ('2021-2022',2021),('2022-2023',2022),('2023-2024',2023),('2024-2025',2024),
  ('2025-2026',2025),('2026-2027',2026),('2027-2028',2027),('2028-2029',2028);

-- us_states seed (50 + DC); KS not KA
insert into us_states(code,name) values
 ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),
 ('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('DC','District of Columbia'),('FL','Florida'),
 ('GA','Georgia'),('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),
 ('IA','Iowa'),('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),
 ('MD','Maryland'),('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),
 ('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),('NH','New Hampshire'),
 ('NJ','New Jersey'),('NM','New Mexico'),('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),
 ('OH','Ohio'),('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),
 ('SC','South Carolina'),('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),
 ('VT','Vermont'),('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming');

-- ── 20260716000002_profile_locks_and_dob_grant.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Profile UPDATE grants + role lock trigger.
--
-- Two things:
-- 1. Add dob + role_title to the profiles UPDATE column allow-list.
--    Onboarding needs to write both (mandatory-field set); the baseline
--    grant omitted them so mandatory-field completion would silently
--    fail with a "permission denied for column" error.
--
-- 2. Enforce "role adjustable during onboarding, locked after" per the
--    Auth & Onboarding spec + SCHEMA-DESIGN §13.1. The column grant
--    lets the client write role_title / user_type; a BEFORE UPDATE
--    trigger raises if either column changes after onboarding_completed
--    flips to true. user_type is also locked from the trigger side
--    because we never want an attendee to become an ED post-signup.
-- ─────────────────────────────────────────────────────────────────────

grant update (dob, role_title) on profiles to authenticated;

create or replace function trg_lock_profile_role()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
begin
  if old.onboarding_completed then
    if new.role_title is distinct from old.role_title then
      raise exception 'role_title is locked once onboarding is complete'
        using errcode = '42501';
    end if;
    if new.user_type is distinct from old.user_type then
      raise exception 'user_type is locked once onboarding is complete'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger t_profiles_lock_role_type
  before update on profiles
  for each row execute function trg_lock_profile_role();

-- ── 20260716000003_comments_read_requires_visible_review.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Tighten comment reads to require the parent review to be visible.
--
-- The baseline policy was:
--   p_comments_read: NOT (this user hid this comment) OR is_admin()
-- which lets any caller read comments on a *draft* review as long as
-- they hadn't personally flagged the comment. That leaks the fact that
-- a draft-review author has been getting comments (there shouldn't be
-- any yet — RLS on comments.insert requires auth.uid() to be the author
-- and comment INSERT requires review visibility in the app layer — but
-- defence in depth belongs here).
--
-- New rule: a caller can read a comment iff they can read the review it
-- hangs off (published, or authored by them, or admin) AND haven't
-- personally hidden the comment; admin still sees everything.
-- ─────────────────────────────────────────────────────────────────────

drop policy p_comments_read on comments;

create policy p_comments_read on comments for select using (
  is_admin()
  or (
    exists (
      select 1 from reviews r
      where r.id = comments.review_id
        and (r.status = 'published' or r.author_id = auth.uid())
    )
    and not exists (
      select 1 from content_hidden h
      where h.user_id = auth.uid()
        and h.content_type = 'comment'
        and h.content_id = comments.id
    )
  )
);

-- ── 20260716000004_handle_new_user_role_default.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- handle_new_user role default must match the incoming user_type.
--
-- Baseline used a static default: role_title='coach' for everyone. That
-- fails role_matches_type when the incoming user_type is
-- 'event_director' (coach is only valid for attendees). Signup would
-- crash inside the auth trigger with a check-constraint violation.
--
-- New behaviour: pick the role default per user_type. Admin accepts any
-- role_title per the check-constraint; we use 'coach' as a neutral
-- placeholder (admin roles are never surfaced in the UI anyway).
-- Signup metadata may still override with an explicit role_title.
-- ─────────────────────────────────────────────────────────────────────

create or replace function handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_type user_type;
  v_role role_title;
begin
  v_type := coalesce(
    (new.raw_user_meta_data ->> 'user_type')::user_type,
    'attendee'
  );
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role_title')::role_title,
    case v_type
      when 'event_director' then 'event_director'::role_title
      when 'attendee'       then 'coach'::role_title
      else 'coach'::role_title
    end
  );
  insert into profiles (id, user_type, role_title, first_name)
  values (new.id, v_type, v_role, new.raw_user_meta_data ->> 'first_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 20260716000005_stamp_premium_at.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Stamp `events.premium_at` on the false → true transition of
-- `is_premium`, and never again. SCHEMA-DESIGN §9 called this trigger
-- out as carry-forward from the audit but the from-scratch baseline
-- omitted it. Without the trigger, `premium_at` stays null even after
-- an upgrade, and the "how long has this been premium" surface breaks.
--
-- - INSERT: if is_premium is true on creation, stamp now().
-- - UPDATE: if is_premium flipped from false → true, stamp now().
--   Any other transition (true → false, or true → true) leaves the
--   existing premium_at alone — coalesce preserves it.
-- ─────────────────────────────────────────────────────────────────────

create or replace function stamp_premium_at()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.is_premium then
    new.premium_at := coalesce(new.premium_at, now());
  elsif tg_op = 'UPDATE' and new.is_premium and not old.is_premium then
    new.premium_at := coalesce(new.premium_at, now());
  end if;
  return new;
end;
$$;

create trigger t_events_stamp_premium
  before insert or update on events
  for each row execute function stamp_premium_at();

-- ── 20260716000006_reviews_published_at_stamp.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Stamp reviews.published_at on the draft → published transition.
--
-- The baseline's trg_reviews_write already:
--   - keeps `overall` in sync (avg of non-null category scores)
--   - increments platform_counters.published_reviews_total
-- …but it never sets `published_at`. Since the column is not in the
-- authenticated UPDATE grant (correct — the client shouldn't be able
-- to backdate a review), publish would leave the timestamp NULL.
--
-- Extend the trigger so that:
--   - INSERT with status='published' stamps published_at = now()
--   - UPDATE where status flips draft → published stamps published_at
--   - Other transitions leave the value alone (published → draft or
--     published → published preserves the original publish time).
-- ─────────────────────────────────────────────────────────────────────

create or replace function trg_reviews_write()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.overall = review_overall(new);

    if tg_op = 'INSERT' and new.status = 'published' then
      new.published_at = coalesce(new.published_at, now());
      update platform_counters set value = value + 1
        where key = 'published_reviews_total';
    elsif tg_op = 'UPDATE' and old.status <> 'published' and new.status = 'published' then
      new.published_at = coalesce(new.published_at, now());
      update platform_counters set value = value + 1
        where key = 'published_reviews_total';
    end if;

    return new;
  end if;
  return old;
end;
$$;

-- ── 20260716000007_submitted_csvs_raw_emails.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- submitted_csvs.raw_emails — the parsed list of coach emails from the
-- ED's uploaded CSV, stored inline as a JSONB array so admin review
-- can render the row list without going back to the bucket.
--
-- Trade-off: reduces the CSV to its email column. The Reviews spec
-- ("Limit of 1000 rows per file") caps this at ~1000 short strings, a
-- few tens of KB max — well within JSONB's happy path.
--
-- The `file_path` column stays on the table because a follow-up will
-- wire the private bucket upload flow (see DECISIONS §S3.1). Until
-- then, an in-memory synthetic string is fine for the primary flow.
-- ─────────────────────────────────────────────────────────────────────

alter table submitted_csvs
  add column if not exists raw_emails jsonb not null default '[]'::jsonb;

alter table submitted_csvs
  alter column file_path drop not null;

-- ── 20260716000008_claim_request_rpcs.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Atomic claim-request RPCs.
--
-- approve_claim_request(target_claim):
--   - Sets the claim to approved
--   - Transfers ownership of the tournament + all its events to the
--     requester (spec: ownership + all sibling events + linked
--     tournament move together)
--   - Auto-declines every other pending claim on the same tournament
--     with a canonical decline reason (spec: "all the other pending
--     requests on this event should be automatically marked as
--     rejected")
--   All in one transaction so a partial write can't happen.
--
-- decline_claim_request(target_claim, reason):
--   - Sets the claim to declined with the admin's reason
--   - Leaves ownership state alone
--
-- Both are SECURITY DEFINER so they can flip the columns the client
-- grant otherwise blocks (owner_id + claimed on events / tournaments).
-- Callers must be admins — the RPC checks is_admin() at entry.
-- ─────────────────────────────────────────────────────────────────────

create or replace function approve_claim_request(target_claim uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_tournament uuid;
  v_requester  uuid;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select tournament_id, requester_id into v_tournament, v_requester
    from claim_requests where id = target_claim;
  if v_tournament is null then
    raise exception 'claim request % not found', target_claim
      using errcode = '02000';
  end if;

  -- 1. Mark this claim approved.
  update claim_requests
     set status = 'approved', decline_reason = null
   where id = target_claim;

  -- 2. Transfer the tournament to the requester.
  update tournaments
     set owner_id = v_requester,
         claimed = true
   where id = v_tournament;

  -- 3. Transfer every event under the tournament.
  update events
     set owner_id = v_requester,
         claimed = true
   where tournament_id = v_tournament;

  -- 4. Auto-decline every other pending claim on the same tournament.
  update claim_requests
     set status = 'declined',
         decline_reason = 'Another claim on this tournament was approved.'
   where tournament_id = v_tournament
     and id <> target_claim
     and status = 'pending';
end;
$$;

create or replace function decline_claim_request(
  target_claim uuid,
  reason text
) returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if reason is null or length(btrim(reason)) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;
  update claim_requests
     set status = 'declined',
         decline_reason = btrim(reason)
   where id = target_claim
     and status = 'pending';
end;
$$;

-- ── 20260716000009_account_deletion_and_activity_cap.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Account deletion (attendee + ED variants) and recently_viewed cap.
--
-- delete_ed_account(target):
--   - Resets owner_id on events + tournaments the ED claimed but did
--     not originally create (spec: those "should not be deleted,
--     instead they should reset the owner field so the admin can
--     manage them again").
--   - Deletes events the ED both created + still owns, using the
--     existing delete_event RPC so their reviews get detached with
--     snapshots.
--   - Runs anonymize_account so their own reviews + comments stay
--     visible but lose PII.
--   - Nulls identity fields on the profile row itself so the shell
--     surfaces stop showing their name after delete.
--
-- soft_delete_attendee(target):
--   - Runs anonymize_account (already exists).
--   - Nulls profile identity fields the same way.
--
-- Both intentionally leave auth.users in place — clean-up of the
-- auth row itself needs SUPABASE_SERVICE_ROLE_KEY on the client and
-- is a follow-up (see DECISIONS §S6.1). Blocked flag flips to true
-- so the middleware immediately signs the user out on the next
-- request.
--
-- trim_recently_viewed:
--   After insert trigger keeps the per-user recently_viewed set at
--   most 50 rows (spec: "recently_viewed capped at 50"). Cheaper +
--   simpler than a scheduled job.
-- ─────────────────────────────────────────────────────────────────────

create or replace function scrub_profile_identity(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  update profiles
     set first_name = null,
         last_name = null,
         dob = null,
         user_gender = null,
         location_lat = null,
         location_lng = null,
         location_formatted = null,
         location_city = null,
         location_state_full = null,
         location_state_abbr = null,
         location_zip = null,
         location_place_id = null,
         distance_pref = null,
         organization_title = null,
         org_description = null,
         org_logo_url = null,
         profile_photo_url = null,
         blocked = true
   where id = target_user;
end;
$$;

create or replace function soft_delete_attendee(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  perform anonymize_account(target_user);
  delete from favorites where user_id = target_user;
  delete from recently_viewed where user_id = target_user;
  delete from review_helpful where user_id = target_user;
  delete from content_hidden where user_id = target_user;
  perform scrub_profile_identity(target_user);
end;
$$;

create or replace function delete_ed_account(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare ev uuid;
begin
  -- Reset owner on claimed-but-not-created events + tournaments.
  update events
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  update tournaments
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  -- Delete events + their tournaments where the ED both created and
  -- still owns. Existing delete_event detaches attached reviews.
  for ev in
    select id from events
      where owner_id = target_user
        and created_by = target_user
  loop
    perform delete_event(ev);
  end loop;
  delete from tournaments
    where owner_id = target_user
      and created_by = target_user;
  delete from submitted_csvs where ed_id = target_user;
  perform anonymize_account(target_user);
  perform scrub_profile_identity(target_user);
end;
$$;

create or replace function trim_recently_viewed()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  overflow_cutoff timestamptz;
begin
  select viewed_at into overflow_cutoff
    from recently_viewed
   where user_id = new.user_id
   order by viewed_at desc
   offset 49
   limit 1;
  if overflow_cutoff is not null then
    delete from recently_viewed
      where user_id = new.user_id
        and viewed_at < overflow_cutoff;
  end if;
  return new;
end;
$$;

create trigger t_recently_viewed_cap
  after insert on recently_viewed
  for each row execute function trim_recently_viewed();

-- ── 20260716000010_admin_user_ops.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Admin user-ops RPCs.
--
-- admin_set_blocked(target, is_blocked):
--   Flip the `profiles.blocked` flag. The column isn't in the
--   authenticated UPDATE grant (spec: only admin can flip it), so
--   this SECURITY DEFINER wrapper is the client's path. When
--   `is_blocked` = true the middleware immediately signs the user
--   out on the next request.
--
-- admin_delete_user(target):
--   Delegate to the role-appropriate soft-delete. Admin accounts are
--   protected from being deleted this way.
-- ─────────────────────────────────────────────────────────────────────

create or replace function admin_set_blocked(
  target_user uuid,
  is_blocked boolean
) returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update profiles
     set blocked = is_blocked
   where id = target_user;
end;
$$;

create or replace function admin_delete_user(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare v_type user_type;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select user_type into v_type from profiles where id = target_user;
  if v_type is null then
    raise exception 'user not found' using errcode = '02000';
  end if;
  if v_type = 'admin' then
    raise exception 'cannot delete admin via this action' using errcode = '42501';
  end if;
  if v_type = 'event_director' then
    perform delete_ed_account(target_user);
  else
    perform soft_delete_attendee(target_user);
  end if;
end;
$$;

-- ── 20260716000011_review_gate_1_security_floor.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Review Gate 1 — security floor. Pattern-class fixes for C1, C2, C3.
--
-- The theme: RLS is enforced at the table level, but the app also
-- exposes SECURITY DEFINER functions whose EXECUTE grant is PUBLIC by
-- default. That let any authenticated caller drive destructive ops
-- with no ownership check. We do two things per pattern class:
--
--   1. Every destructive definer function gets an is_admin() OR
--      ownership check at entry (defense in depth).
--   2. Every trigger-only definer + every recalc/helper function has
--      its EXECUTE grant revoked from PUBLIC / anon / authenticated
--      (only the trigger runtime + postgres can invoke it).
--
-- Also:
--   - handle_new_user coerces user_type: `admin` is refused, we force
--     attendee/event_director from the metadata.
--   - apply_promo_to_review validates promo↔review↔caller↔event↔status
--     end to end and enforces one-review-per-event resolution.
-- ─────────────────────────────────────────────────────────────────────

-- Hosted Supabase leaves `extensions` off the session search_path, so citext
-- arg types below would fail at CREATE-time. Local dev's stack already has
-- extensions on the path so this is a no-op there.
set search_path = public, extensions, pg_temp;

-- ── C1: signup trigger must never trust raw_user_meta_data.user_type
create or replace function handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  requested_type text;
  v_type user_type;
  v_role role_title;
begin
  requested_type := new.raw_user_meta_data ->> 'user_type';
  -- `admin` is NEVER a self-signup type — coerce anything unknown to attendee.
  v_type := case requested_type
    when 'event_director' then 'event_director'::user_type
    else 'attendee'::user_type
  end;
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role_title')::role_title,
    case v_type
      when 'event_director' then 'event_director'::role_title
      else 'coach'::role_title
    end
  );
  -- Force role_title back into the valid set for the resolved type; if
  -- the client sent a mismatching role, use a safe default.
  if v_type = 'attendee' and v_role not in ('coach', 'parent_spectator', 'team_manager') then
    v_role := 'coach';
  elsif v_type = 'event_director' and v_role not in ('event_director', 'event_admin', 'club_director') then
    v_role := 'event_director';
  end if;

  insert into profiles (id, user_type, role_title, first_name)
  values (new.id, v_type, v_role, new.raw_user_meta_data ->> 'first_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── C2: destructive definer RPCs need ownership / is_admin() guards.

-- delete_event: admin OR event owner
create or replace function delete_event(target_event uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_tournament uuid;
begin
  select tournament_id, owner_id
    into v_tournament, v_owner
    from events where id = target_event;
  if v_tournament is null then
    return;  -- already gone
  end if;
  if not (is_admin() or v_owner = auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update reviews r set
    detached = true,
    event_id = null,
    snapshot_event_title      = e.title,
    snapshot_tournament_title = tr.title,
    snapshot_event_start      = e.start_date,
    snapshot_event_end        = e.end_date,
    snapshot_event_location   = e.location_formatted,
    snapshot_event_logo       = e.logo_url
  from events e
  left join tournaments tr on tr.id = e.tournament_id
  where r.event_id = target_event and e.id = target_event;

  delete from events where id = target_event;
  perform recalc_tournament_ratings(v_tournament);
end;
$$;

-- delete_tournament: admin OR tournament owner
create or replace function delete_tournament(target_tournament uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  ev uuid;
begin
  select owner_id into v_owner from tournaments where id = target_tournament;
  if v_owner is null and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not (is_admin() or v_owner = auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for ev in select id from events where tournament_id = target_tournament loop
    perform delete_event(ev);
  end loop;
  delete from tournaments where id = target_tournament;
end;
$$;

-- scrub_profile_identity: caller must be the target user OR an admin
create or replace function scrub_profile_identity(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not (is_admin() or auth.uid() = target_user) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update profiles
     set first_name = null,
         last_name = null,
         dob = null,
         user_gender = null,
         location_lat = null,
         location_lng = null,
         location_formatted = null,
         location_city = null,
         location_state_full = null,
         location_state_abbr = null,
         location_zip = null,
         location_place_id = null,
         distance_pref = null,
         organization_title = null,
         org_description = null,
         org_logo_url = null,
         profile_photo_url = null,
         blocked = true
   where id = target_user;
end;
$$;

-- anonymize_account: caller must be the target user OR an admin
create or replace function anonymize_account(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not (is_admin() or auth.uid() = target_user) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update reviews  set anonymized = true, author_id = null where author_id = target_user;
  update comments set anonymized = true, author_id = null where author_id = target_user;
end;
$$;

-- soft_delete_attendee: caller must be the target user OR an admin
create or replace function soft_delete_attendee(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not (is_admin() or auth.uid() = target_user) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform anonymize_account(target_user);
  delete from favorites       where user_id = target_user;
  delete from recently_viewed where user_id = target_user;
  delete from review_helpful  where user_id = target_user;
  delete from content_hidden  where user_id = target_user;
  perform scrub_profile_identity(target_user);
end;
$$;

-- delete_ed_account: caller must be the target user OR an admin
create or replace function delete_ed_account(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare ev uuid;
begin
  if not (is_admin() or auth.uid() = target_user) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update events
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  update tournaments
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  for ev in
    select id from events
      where owner_id = target_user
        and created_by = target_user
  loop
    perform delete_event(ev);
  end loop;
  delete from tournaments
    where owner_id = target_user and created_by = target_user;
  delete from submitted_csvs where ed_id = target_user;
  perform anonymize_account(target_user);
  perform scrub_profile_identity(target_user);
end;
$$;

-- ── C3: apply_promo_to_review validates the promo binding end-to-end.
--
-- Every step of the "coach applies a promo to their review" flow gets
-- verified inside the RPC so a client-supplied promo_id can't stamp a
-- Guru badge on someone else's review or void an unrelated promo.
-- Also enforces one-review-per-event resolution — a promo already
-- applied to another review returns an error instead of silently
-- clobbering guru_review on the caller's row.
create or replace function apply_promo_to_review(
  p_review uuid,
  p_promo  uuid
) returns void
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
as $$
declare
  v_author uuid;
  v_review_event uuid;
  v_review_status review_status;
  v_review_guru boolean;
  v_promo_event uuid;
  v_promo_email citext;
  v_promo_user  uuid;
  v_promo_status promo_status;
  v_caller_email citext;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  select author_id, event_id, status, guru_review
    into v_author, v_review_event, v_review_status, v_review_guru
    from reviews where id = p_review;
  if v_author is null and v_review_event is null then
    raise exception 'review not found' using errcode = '02000';
  end if;
  if v_author <> auth.uid() then
    raise exception 'review not yours' using errcode = '42501';
  end if;
  if v_review_guru then
    raise exception 'review already verified' using errcode = '42501';
  end if;

  select event_id, email, user_id, status
    into v_promo_event, v_promo_email, v_promo_user, v_promo_status
    from promo_codes where id = p_promo;
  if v_promo_event is null and v_promo_email is null then
    raise exception 'promo not found' using errcode = '02000';
  end if;
  if v_promo_status = 'applied' then
    raise exception 'promo already applied' using errcode = '42501';
  end if;
  if v_promo_status = 'void' then
    raise exception 'promo is void' using errcode = '42501';
  end if;
  if v_promo_event is distinct from v_review_event then
    raise exception 'promo/review event mismatch' using errcode = '42501';
  end if;

  select email::citext into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null then
    raise exception 'no caller email on file' using errcode = '42501';
  end if;
  if v_promo_email <> v_caller_email and (v_promo_user is null or v_promo_user <> auth.uid()) then
    raise exception 'promo not addressed to you' using errcode = '42501';
  end if;

  update reviews
     set guru_review = true, promo_id = p_promo
   where id = p_review;
  update promo_codes
     set status = 'applied', applied_at = now()
   where id = p_promo;
  -- Any other non-applied promo issued to the same email + event goes
  -- to void so the coach can't reapply another one.
  update promo_codes
     set status = 'void'
   where email = v_promo_email
     and event_id = v_promo_event
     and id <> p_promo
     and status <> 'applied';
end;
$$;

-- ── C2 continued: trigger-only + recalc functions revoked from clients.

revoke execute on function handle_new_user()              from public, anon, authenticated;
revoke execute on function touch_updated_at()             from public, anon, authenticated;
revoke execute on function trg_reviews_write()            from public, anon, authenticated;
revoke execute on function trg_reviews_recalc()           from public, anon, authenticated;
revoke execute on function trg_helpful_count()            from public, anon, authenticated;
revoke execute on function trg_event_search()             from public, anon, authenticated;
revoke execute on function trg_search_queries_rate_limit()   from public, anon, authenticated;
revoke execute on function trg_contact_requests_rate_limit() from public, anon, authenticated;
revoke execute on function stamp_premium_at()             from public, anon, authenticated;
revoke execute on function trg_lock_profile_role()        from public, anon, authenticated;
revoke execute on function trim_recently_viewed()         from public, anon, authenticated;
revoke execute on function recalc_event_ratings(uuid)     from public, anon, authenticated;
revoke execute on function recalc_tournament_ratings(uuid) from public, anon, authenticated;
revoke execute on function rate_limit_prune()             from public, anon, authenticated;
revoke execute on function review_overall(reviews)        from public, anon, authenticated;

-- ── 20260716000012_review_gate_1_promo_views_onboarding.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Review Gate 1 — C4 (+M2), H1, H2.
--
-- C4 (+M2): the promo landing flow could not complete for any
-- non-admin caller because promo_codes RLS restricted reads to
-- admin / already-linked user / owning ED, and the funnel insert
-- policy was admin-only. Replaced with two SECURITY DEFINER RPCs:
--   - promo_landing_info(token) : anon-callable, returns event_id +
--     email hint if the token is on file (never leaks caller state).
--   - claim_promo(token) : authenticated-only, requires the caller's
--     auth.users.email to match promo.email. Flips 'sent' → 'active',
--     attaches user_id, logs a 'landed' funnel event, and returns
--     the promo_id + event_id the client needs to route into the
--     review form.
--
-- H1: public reviewer + comment + host reads must go through
-- SECURITY DEFINER views so anon callers see the display fields
-- (spec-safe: first_name + org + photo; NEVER last_name / email /
-- dob). Widens the existing review_author_public with org info and
-- introduces public_comment_authors + public_event_owner views.
--
-- H2: onboarding step 3 is optional in content (per SCHEMA-DESIGN
-- §11) but the wizard's completion checker guessed at whether the
-- user had submitted the step by inspecting distance_pref. Adds a
-- profiles.preferences_completed marker so the wizard has an
-- explicit signal.
-- ─────────────────────────────────────────────────────────────────────

-- Hosted Supabase leaves `extensions` off the session search_path, so citext
-- return / arg types below would fail at CREATE-time. Local dev's stack
-- already has extensions on the path so this is a no-op there.
set search_path = public, extensions, pg_temp;

-- ── C4: promo landing RPCs
create or replace function promo_landing_info(p_token text)
  returns table(event_id uuid, email citext)
  language sql
  security definer
  set search_path = public, extensions, pg_temp
as $$
  select event_id, email
  from promo_codes
  where url_token = p_token
    and status <> 'void'
  limit 1;
$$;

create or replace function claim_promo(p_token text)
  returns table(promo_id uuid, event_id uuid)
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
as $$
declare
  v_promo promo_codes;
  v_caller_email citext;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  select * into v_promo from promo_codes where url_token = p_token;
  if v_promo.id is null or v_promo.status = 'void' then
    raise exception 'promo not available' using errcode = '02000';
  end if;

  select email::citext into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null or v_promo.email <> v_caller_email then
    raise exception 'promo not addressed to you' using errcode = '42501';
  end if;

  if v_promo.status = 'sent' then
    update promo_codes set status = 'active' where id = v_promo.id;
  end if;
  if v_promo.user_id is null then
    update promo_codes set user_id = auth.uid() where id = v_promo.id;
  end if;
  insert into promo_funnel_events(promo_id, step) values (v_promo.id, 'landed');

  promo_id := v_promo.id;
  event_id := v_promo.event_id;
  return next;
end;
$$;

-- Anon may resolve the token (safe: returns only event + email hint
-- for a token they already possess via email). Authenticated may
-- claim it.
grant execute on function promo_landing_info(text) to anon, authenticated;
grant execute on function claim_promo(text) to authenticated;

-- ── H1: public identity views
--
-- Drop + recreate the review_author_public view to widen its column
-- set to what the public review card needs. Anonymized rows return
-- NULL identity fields but keep the role + guru flag so the badge
-- still renders.
drop view if exists review_author_public;
create view review_author_public
  with (security_invoker = false)
as
  select r.id  as review_id,
         case when r.anonymized then null else p.first_name end          as first_name,
         case when r.anonymized then null else p.organization_title end  as organization_title,
         case when r.anonymized then null else p.profile_photo_url end   as profile_photo_url,
         r.reviewer_role,
         r.guru_review
  from reviews r
  left join profiles p on p.id = r.author_id;

-- Public comment author view — used by the public event page's
-- comment renders. Adds org_logo + user_type so the ED-owner reply
-- shows org branding instead of the personal profile.
create view public_comment_authors
  with (security_invoker = false)
as
  select c.id  as comment_id,
         case when c.anonymized then null else p.first_name end         as first_name,
         case when c.anonymized then null else p.organization_title end as organization_title,
         case when c.anonymized then null else p.org_logo_url end       as org_logo_url,
         case when c.anonymized then null else p.profile_photo_url end  as profile_photo_url,
         case when c.anonymized then null else p.user_type::text end    as user_type,
         c.author_id,
         c.is_owner_reply
  from comments c
  left join profiles p on p.id = c.author_id;

-- Host sidebar on the public event page. Wraps the same guarantee as
-- public_directors but keyed by owner_id so the code can select the
-- host by event.owner_id in one round trip. Includes org_description
-- so the sidebar can render the "About" blurb.
create view public_event_owners
  with (security_invoker = false)
as
  select p.id,
         p.first_name,
         p.organization_title,
         p.org_logo_url,
         p.org_description,
         p.profile_photo_url
  from profiles p
  where p.user_type = 'event_director';

grant select on review_author_public,
                public_comment_authors,
                public_event_owners
  to anon, authenticated;

-- ── H2: preferences_completed marker
alter table profiles
  add column if not exists preferences_completed boolean not null default false;

-- Extend the client UPDATE allow-list so the onboarding action can
-- flip it. Safe to expose: the user still has to satisfy step 1 + 2
-- + step 4 (ED) before onboarding_completed flips to true.
grant update (preferences_completed) on profiles to authenticated;

-- ── 20260716000013_platform_counter_triggers.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- M1 (RG1 medium) — increment platform_counters on create.
--
-- `published_reviews_total` already increments via trg_reviews_write
-- on the draft→published transition. The `listed_events_total` and
-- `listed_tournaments_total` counters were seeded at 0 and NEVER
-- moved, so the landing page's stats band read `0 / 0 / N reviews`
-- after events + tournaments landed on the platform.
--
-- Same never-decrement rule as reviews (per SCHEMA-DESIGN §8): only
-- INSERT counts. Delete leaves the counter at its historical high.
-- ─────────────────────────────────────────────────────────────────────

create or replace function trg_bump_tournament_counter()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  update platform_counters
     set value = value + 1
   where key = 'listed_tournaments_total';
  return new;
end;
$$;

create or replace function trg_bump_event_counter()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  update platform_counters
     set value = value + 1
   where key = 'listed_events_total';
  return new;
end;
$$;

create trigger t_tournaments_bump_counter
  after insert on tournaments
  for each row execute function trg_bump_tournament_counter();

create trigger t_events_bump_counter
  after insert on events
  for each row execute function trg_bump_event_counter();

-- Consistent with the rest of the trigger-only helper functions
-- (see migration 20260716000011): revoke client EXECUTE so the only
-- callable path is the trigger runtime.
revoke execute on function trg_bump_tournament_counter() from public, anon, authenticated;
revoke execute on function trg_bump_event_counter()      from public, anon, authenticated;

-- ── 20260716000014_drop_dead_tables.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Turbo-check M-DEAD-3 — drop dead tables.
--
-- `regions` was seeded with I–IV but nothing reads or writes it. The
-- events column `region` is a Postgres enum (event_region), not a FK
-- into `regions`, so the table has no referential purpose either.
-- `EVENT_REGIONS` in lib/enums.ts is the single source of truth for
-- the UI.
--
-- `contact_requests` has a table + RLS policy + rate-limit trigger,
-- but nothing writes to it: the support form uses `support_messages`
-- and no public marketing contact page ships in the rebuild. Dropping
-- the table also lets us drop its rate-limit trigger + its bucket
-- entry from the `rate_limit_touch` allow-list.
--
-- `event_milestones` STAYS. It has a read path (public event page) +
-- no write path today; the empty-state render is a separate turbo-
-- check fix (M-DEAD-2) and wiring the editor is on the backlog.
-- ─────────────────────────────────────────────────────────────────────

drop trigger if exists t_contact_rl on contact_requests;
drop table if exists contact_requests;
drop function if exists trg_contact_requests_rate_limit();

drop table if exists regions;

-- The rate_limit_touch allow-list still names 'contact_requests' for
-- backwards compatibility with any future public contact form; the
-- bucket name is a string, not a table reference, so we leave it as
-- a reserved token. If a caller ever passes it and the trigger is
-- gone, the touch still works — it just never fires from a table
-- insert.

-- ── 20260716000015_apply_promo_review_or_guard.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Turbo-check L-SQL-1 — tighten `review not found` guard in
-- apply_promo_to_review.
--
-- Original guard used `AND` between two nullable columns:
--     if v_author is null and v_review_event is null then raise ...
-- A malformed / partial row where only one field came back null would
-- fall through to the next check. Not a real security hole (the
-- follow-up `v_author <> auth.uid()` still rejects a non-owner), but
-- the intent was `OR` — if EITHER field is null the row lookup didn't
-- find a real review. Same for the promo lookup a few lines down.
--
-- Every other guard in the function stays intact; this migration only
-- swaps the two AND conjunctions to OR + reruns the full C3 probe
-- suite to prove authorization didn't weaken.
-- ─────────────────────────────────────────────────────────────────────

-- Hosted Supabase leaves `extensions` off the session search_path, so citext
-- declares below would fail at CREATE-time. Local dev's stack already has
-- extensions on the path so this is a no-op there.
set search_path = public, extensions, pg_temp;

create or replace function apply_promo_to_review(
  p_review uuid,
  p_promo  uuid
) returns void
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
as $$
declare
  v_author uuid;
  v_review_event uuid;
  v_review_status review_status;
  v_review_guru boolean;
  v_promo_event uuid;
  v_promo_email citext;
  v_promo_user  uuid;
  v_promo_status promo_status;
  v_caller_email citext;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  select author_id, event_id, status, guru_review
    into v_author, v_review_event, v_review_status, v_review_guru
    from reviews where id = p_review;
  if v_author is null or v_review_event is null then
    raise exception 'review not found' using errcode = '02000';
  end if;
  if v_author <> auth.uid() then
    raise exception 'review not yours' using errcode = '42501';
  end if;
  if v_review_guru then
    raise exception 'review already verified' using errcode = '42501';
  end if;

  select event_id, email, user_id, status
    into v_promo_event, v_promo_email, v_promo_user, v_promo_status
    from promo_codes where id = p_promo;
  if v_promo_event is null or v_promo_email is null then
    raise exception 'promo not found' using errcode = '02000';
  end if;
  if v_promo_status = 'applied' then
    raise exception 'promo already applied' using errcode = '42501';
  end if;
  if v_promo_status = 'void' then
    raise exception 'promo is void' using errcode = '42501';
  end if;
  if v_promo_event is distinct from v_review_event then
    raise exception 'promo/review event mismatch' using errcode = '42501';
  end if;

  select email::citext into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null then
    raise exception 'no caller email on file' using errcode = '42501';
  end if;
  if v_promo_email <> v_caller_email and (v_promo_user is null or v_promo_user <> auth.uid()) then
    raise exception 'promo not addressed to you' using errcode = '42501';
  end if;

  update reviews
     set guru_review = true, promo_id = p_promo
   where id = p_review;
  update promo_codes
     set status = 'applied', applied_at = now()
   where id = p_promo;
  update promo_codes
     set status = 'void'
   where email = v_promo_email
     and event_id = v_promo_event
     and id <> p_promo
     and status <> 'applied';
end;
$$;

-- ── 20260718000001_rename_sponsored_to_general_ad.sql ──────────────────────────────────────────
-- Rename is_sponsored → is_general_ad
-- The "General Ads" tier (public label "Spotlight") replaces the old
-- "sponsored" concept. One flag, one concept, no second boolean.

-- 1. Rename the column
alter table events rename column is_sponsored to is_general_ad;

-- 2. Rebuild the composite index with the new name
drop index if exists idx_events_flags;
create index idx_events_flags on events(is_premium, is_general_ad);

-- ── 20260718000002_event_tier_column_grants.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Event tier column grants + admin-only RPCs.
--
-- Problem: is_premium and is_general_ad have no column-level
-- restriction — any event owner can UPDATE them directly (self-upgrade).
-- The UI hides the controls from non-admins, but RLS p_events_write
-- allows owner_id = auth.uid() on ALL columns.
--
-- Fix (same pattern as profiles/reviews column grants in baseline):
--   1. Revoke blanket UPDATE on events from authenticated.
--   2. Re-grant UPDATE on every column EXCEPT the tier flags
--      (is_premium, is_general_ad, premium_at) and the denormalized
--      aggregates (triggers own those).
--   3. Gate INSERT the same way so event creation can't sneak in
--      is_premium = true or is_general_ad = true.
--   4. Two SECURITY DEFINER RPCs (admin_set_premium, admin_set_general_ad)
--      with is_admin() entry checks — the only path to flip the flags.
-- ─────────────────────────────────────────────────────────────────────

-- ── Column-grant allow-lists ────────────────────────────────────────

revoke update on events from authenticated;
grant  update (
  tournament_id, owner_id, created_by, claimed,
  logo_url, title, website_url, host_club,
  start_date, end_date, registration_deadline, description,
  location_lat, location_lng, location_formatted, location_city,
  location_state_full, location_state_abbr, location_zip, location_place_id,
  num_teams_this_year, region, season_id,
  lifecycle, cancel_reason,
  video_url, teams_this_year_url, teams_prev_year_url,
  registration_url, teams_attended_prev_year,
  updated_at
) on events to authenticated;
-- omits: is_premium, is_general_ad, premium_at,
--        general_rating, coach_rating, attendee_rating, review_count,
--        avg_fields, avg_facilities, avg_management, avg_competition,
--        avg_diversity, avg_cost_value, would_return_pct,
--        search_document, search_vector, created_at

revoke insert on events from authenticated;
grant  insert (
  id, tournament_id, owner_id, created_by, claimed,
  logo_url, title, website_url, host_club,
  start_date, end_date, registration_deadline, description,
  location_lat, location_lng, location_formatted, location_city,
  location_state_full, location_state_abbr, location_zip, location_place_id,
  num_teams_this_year, region, season_id,
  lifecycle, cancel_reason,
  video_url, teams_this_year_url, teams_prev_year_url,
  registration_url, teams_attended_prev_year
) on events to authenticated;
-- omits same admin/aggregate columns as UPDATE

-- ── Admin-only RPCs ─────────────────────────────────────────────────

create or replace function admin_set_premium(target_event uuid, val boolean)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update events set is_premium = val where id = target_event;
end;
$$;

create or replace function admin_set_general_ad(target_event uuid, val boolean)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update events set is_general_ad = val where id = target_event;
end;
$$;

-- Only authenticated callers (not anon/public) should invoke these RPCs.
revoke execute on function admin_set_premium(uuid, boolean) from public, anon;
revoke execute on function admin_set_general_ad(uuid, boolean) from public, anon;

-- ── 20260718000003_end_date_not_null.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Dates stay nullable (drafts don't require them). The existing CHECK
-- constraint (end_after_start) already passes when either date is null,
-- so no new CHECK is needed — published events have dates enforced at
-- the application layer. This migration is intentionally a no-op; it
-- replaces the earlier NOT NULL version before it shipped.
-- ─────────────────────────────────────────────────────────────────────

-- no-op: columns stay nullable; publish validation enforces dates

-- ── 20260718000004_review_eligibility.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Review eligibility & moderation
--
-- 1. Tighten reviews INSERT to attendee-type, non-blocked users only.
--    EDs and admins cannot write reviews (RLS boundary, not just UI).
-- 2. Add paid-event guard to apply_promo_to_review — guru/verified
--    reviews are only allowed on paid events (premium or general_ad).
-- ─────────────────────────────────────────────────────────────────────

set search_path = public, extensions, pg_temp;

-- ── 1. Reviews INSERT: attendee-only, non-blocked ────────────────────

drop policy p_reviews_insert on reviews;

create policy p_reviews_insert on reviews for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.user_type = 'attendee'
      and not p.blocked
  )
);

-- ── 2. Guru/verified blocked on non-paid events ─────────────────────

create or replace function apply_promo_to_review(
  p_review uuid,
  p_promo  uuid
) returns void
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
as $$
declare
  v_author uuid;
  v_review_event uuid;
  v_review_status review_status;
  v_review_guru boolean;
  v_promo_event uuid;
  v_promo_email citext;
  v_promo_user  uuid;
  v_promo_status promo_status;
  v_caller_email citext;
  v_is_paid boolean;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  select author_id, event_id, status, guru_review
    into v_author, v_review_event, v_review_status, v_review_guru
    from reviews where id = p_review;
  if v_author is null or v_review_event is null then
    raise exception 'review not found' using errcode = '02000';
  end if;
  if v_author <> auth.uid() then
    raise exception 'review not yours' using errcode = '42501';
  end if;
  if v_review_guru then
    raise exception 'review already verified' using errcode = '42501';
  end if;

  -- Guru/verified only on paid events (premium or general_ad).
  select (is_premium or is_general_ad) into v_is_paid
    from events where id = v_review_event;
  if not coalesce(v_is_paid, false) then
    raise exception 'verified reviews require a paid event' using errcode = '42501';
  end if;

  select event_id, email, user_id, status
    into v_promo_event, v_promo_email, v_promo_user, v_promo_status
    from promo_codes where id = p_promo;
  if v_promo_event is null or v_promo_email is null then
    raise exception 'promo not found' using errcode = '02000';
  end if;
  if v_promo_status = 'applied' then
    raise exception 'promo already applied' using errcode = '42501';
  end if;
  if v_promo_status = 'void' then
    raise exception 'promo is void' using errcode = '42501';
  end if;
  if v_promo_event is distinct from v_review_event then
    raise exception 'promo/review event mismatch' using errcode = '42501';
  end if;

  select email::citext into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null then
    raise exception 'no caller email on file' using errcode = '42501';
  end if;
  if v_promo_email <> v_caller_email and (v_promo_user is null or v_promo_user <> auth.uid()) then
    raise exception 'promo not addressed to you' using errcode = '42501';
  end if;

  update reviews
     set guru_review = true, promo_id = p_promo
   where id = p_review;
  update promo_codes
     set status = 'applied', applied_at = now()
   where id = p_promo;
  update promo_codes
     set status = 'void'
   where email = v_promo_email
     and event_id = v_promo_event
     and id <> p_promo
     and status <> 'applied';
end;
$$;

-- ── 20260718000005_fix_default_table_grants.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Fix default table grants for the postgres role.
--
-- supabase_admin's default privileges grant full access to all roles,
-- but postgres's defaults only grant DELETE/TRUNCATE/TRIGGER/REFERENCES.
-- Migrations run as postgres during `supabase db reset`, so tables end
-- up missing SELECT/INSERT/UPDATE for authenticated/service_role/anon.
--
-- Fix: set correct defaults for future tables AND retroactively fix
-- existing tables — then re-apply the column-level restrictions from
-- the baseline + event-tier migrations so they're not widened.
-- ─────────────────────────────────────────────────────────────────────

-- Future tables created by postgres get full grants.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

-- Retroactively fix all existing tables/sequences.
-- Functions are NOT granted here — they default to EXECUTE for PUBLIC
-- on creation and were never part of the missing-grant problem. Granting
-- them would re-enable the ~17 functions that RG1 (000011 + 000013)
-- deliberately revoked.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- ── Re-apply column-level restrictions ──────────────────────────────
-- The broad GRANT ALL above restored table-level INSERT/UPDATE on
-- profiles, reviews, and events, which earlier migrations intentionally
-- revoked in favour of column-level grants.

-- profiles (baseline 000001 l.976-985)
revoke update on profiles from authenticated;
grant  update (first_name, last_name, dob, user_gender,
               location_lat, location_lng, location_formatted, location_city,
               location_state_full, location_state_abbr, location_zip, location_place_id,
               distance_pref, organization_title, org_description, org_logo_url, profile_photo_url,
               onboarding_completed, preferences_completed,
               email_review_replies, inapp_review_replies, email_review_likes, inapp_review_likes,
               email_comment_replies, inapp_comment_replies, email_event_reviews, inapp_event_reviews,
               email_favorited_events, inapp_favorited_events, updated_at)
  on profiles to authenticated;

-- reviews (baseline 000001 l.987-995)
revoke insert on reviews from authenticated;
grant  insert (event_id, author_id, status, rating_fields, rating_facilities, rating_management,
               rating_competition, rating_diversity, rating_cost_value, review_title, review_body,
               would_return, reviewer_user_type, reviewer_role)
  on reviews to authenticated;
revoke update on reviews from authenticated;
grant  update (status, rating_fields, rating_facilities, rating_management, rating_competition,
               rating_diversity, rating_cost_value, review_title, review_body, would_return, updated_at)
  on reviews to authenticated;

-- events (000002 event tier column grants)
revoke insert on events from authenticated;
grant  insert (
  id, tournament_id, owner_id, created_by, claimed,
  logo_url, title, website_url, host_club,
  start_date, end_date, registration_deadline, description,
  location_lat, location_lng, location_formatted, location_city,
  location_state_full, location_state_abbr, location_zip, location_place_id,
  num_teams_this_year, region, season_id,
  lifecycle, cancel_reason,
  video_url, teams_this_year_url, teams_prev_year_url,
  registration_url, teams_attended_prev_year
) on events to authenticated;
revoke update on events from authenticated;
grant  update (
  tournament_id, owner_id, created_by, claimed,
  logo_url, title, website_url, host_club,
  start_date, end_date, registration_deadline, description,
  location_lat, location_lng, location_formatted, location_city,
  location_state_full, location_state_abbr, location_zip, location_place_id,
  num_teams_this_year, region, season_id,
  lifecycle, cancel_reason,
  video_url, teams_this_year_url, teams_prev_year_url,
  registration_url, teams_attended_prev_year,
  updated_at
) on events to authenticated;


-- ── 20260718000006_business_contact_fields.sql ──────────────────────────────────────────
-- Add public business-contact fields to profiles (ED only in practice).
-- These are intentionally public — never the auth email.

alter table profiles
  add column business_phone   text,
  add column business_email   text,
  add column business_website  text;

-- Recreate the public_directors view to include them.
drop view if exists public_directors;
create view public_directors with (security_invoker = false) as
  select id, first_name, last_name, organization_title, org_logo_url,
         org_description, profile_photo_url,
         business_phone, business_email, business_website
  from profiles where user_type = 'event_director';

grant select on public_directors to anon, authenticated;

-- Let authenticated users write their own business contact fields.
-- (The existing column-level UPDATE grant on profiles must include them.)
grant update (business_phone, business_email, business_website)
  on profiles to authenticated;

-- ── 20260718000007_faq_tables.sql ──────────────────────────────────────────
-- FAQ system: upgrade to audience-targeted entries with draft/publish + visibility

-- Add missing columns to existing faqs table
alter table faqs
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'published')),
  add column if not exists is_visible boolean not null default true;

-- Rename body → content for consistency with the scope doc
alter table faqs rename column body to content;

-- Drop the old enum-based audience column — replaced by faq_audiences child table
alter table faqs drop column if exists audience;
drop type if exists faq_audience;

-- Child table for per-type + optional per-role audience targeting
create table faq_audiences (
  id         uuid primary key default gen_random_uuid(),
  faq_id     uuid not null references faqs(id) on delete cascade,
  user_type  user_type not null,
  role_title role_title
);

create index idx_faq_audiences_faq on faq_audiences(faq_id);
create unique index idx_faq_audiences_with_role
  on faq_audiences(faq_id, user_type, role_title) where role_title is not null;
create unique index idx_faq_audiences_no_role
  on faq_audiences(faq_id, user_type) where role_title is null;

-- RLS on faq_audiences
alter table faq_audiences enable row level security;

create policy faq_audiences_admin_all on faq_audiences
  for all using (
    exists (select 1 from profiles where id = auth.uid() and user_type = 'admin')
  );

create policy faq_audiences_public_read on faq_audiences
  for select using (
    exists (select 1 from faqs where id = faq_id and status = 'published' and is_visible = true)
  );

-- Update existing faqs policies: keep admin all, restrict public read to published+visible
drop policy if exists p_faqs_read on faqs;
drop policy if exists p_faqs_admin on faqs;

create policy faqs_admin_all on faqs
  for all using (
    exists (select 1 from profiles where id = auth.uid() and user_type = 'admin')
  );

create policy faqs_public_read on faqs
  for select using (status = 'published' and is_visible = true);

-- Grants
grant select on faq_audiences to anon, authenticated;
grant insert, update, delete on faq_audiences to authenticated;

-- ── 20260718000008_revoke_view_write_grants.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Revoke write privileges on every view in `public`.
--
-- 20260718000005 ran `grant all on all tables in schema public`, and in
-- Postgres `ALL TABLES` includes VIEWS. The `public_*` projection views
-- carry no RLS of their own and are declared `security_invoker = false`
-- with `postgres` as owner (which has BYPASSRLS), so a write through an
-- auto-updatable view executes as the owner and skips RLS on the base
-- table entirely. Table-level grants are therefore the *only* access
-- control on them.
--
-- `public_directors` and `public_event_owners` are single-table selects
-- and thus auto-updatable: `anon` could UPDATE or DELETE rows in
-- `profiles` through them holding nothing but the public anon key.
-- The baseline granted SELECT only (20260716000001 l.1011); 000005
-- silently widened that to full write.
--
-- Every view here is a read projection, so revoke write on all of them
-- rather than enumerating — that also covers the two views that are not
-- currently auto-updatable but would become writable if their
-- definition were ever simplified to a single table.
--
-- NOTE: 000005's `alter default privileges ... grant all on tables`
-- still applies to views created later by `postgres`. The regression
-- probe in tests/probes/h1-public-views.test.ts asserts that no view in
-- `public` is writable by anon/authenticated, which catches that case.
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  v record;
begin
  for v in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'v'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger '
      'on public.%I from anon, authenticated',
      v.relname
    );
  end loop;
end $$;

-- ── 20260718000009_flag_cleanup_triggers.sql ──────────────────────────────────────────
-- H-4 · Orphaned moderation rows: clean up at the DB, not per call site.
--
-- flagged_content and content_hidden are polymorphic (content_type +
-- content_id), so no FK and no cascade is possible — app code had to
-- clean up after every delete, and 5 of 6 delete paths didn't. An
-- orphaned flag row returns from the moderation-queue list query,
-- matches no content in the join, and is therefore never rendered and
-- never dismissable. AFTER DELETE triggers on reviews and comments
-- cover every path — including FK-cascaded deletes (review → comments,
-- comment → child replies), which fire row triggers on the child table.
--
-- SECURITY DEFINER: the deleting user is usually NOT allowed to delete
-- other users' flag rows (p_flag_delete is admin-only), so the cleanup
-- must run as the function owner. search_path is pinned per RG1.

create or replace function public.purge_moderation_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from flagged_content
   where content_type = tg_argv[0]::flag_content_type
     and content_id = old.id;
  delete from content_hidden
   where content_type = tg_argv[0]::flag_content_type
     and content_id = old.id;
  return old;
end;
$$;

-- Trigger-only helper: never client-callable (RG1 convention).
revoke execute on function public.purge_moderation_rows() from public, anon, authenticated;

create trigger t_reviews_purge_moderation
  after delete on reviews
  for each row execute function purge_moderation_rows('review');

create trigger t_comments_purge_moderation
  after delete on comments
  for each row execute function purge_moderation_rows('comment');

-- ── 20260719000001_event_host_write_gate.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Gate tournament/event writes on the caller actually being an event
-- host (event_director or admin).
--
-- `p_tournaments_write` / `p_events_write` only ever asked "is this row
-- yours?" (`owner_id = auth.uid() or is_admin()`) — never "are you a
-- role that may host events at all". An attendee satisfies
-- `owner_id = auth.uid()` simply by writing their own id into the
-- payload, and both tables grant INSERT/UPDATE on `owner_id`,
-- `claimed`, and `lifecycle` to `authenticated`. So any attendee could,
-- straight through PostgREST:
--
--   1. INSERT a tournament with owner_id = self          → allowed
--   2. INSERT an event under it with lifecycle='active'  → allowed
--   3. anon then reads it (p_events_read: lifecycle <> 'draft')
--
-- i.e. inject arbitrary published listings into public discovery. The
-- only thing standing in the way was the `user_type === 'attendee'`
-- check inside the createTournament server action, which is an
-- affordance and not a boundary — the same shape as C-1, where write
-- grants on the public_* views were the sole control.
--
-- The tier columns (`is_premium`, `is_general_ad`) are already withheld
-- from the column grants, so this was never a route to Featured /
-- Spotlight placement — but ordinary public listings were reachable.
--
-- `is_admin()` implies `is_event_host()`, so the admin branch is
-- unchanged: admins keep writing rows they don't own (owner_id null =
-- unclaimed, per S1.1). EDs still manage only their own.
--
-- The event child tables (event_age_groups, sponsors, …) delegate to the
-- parent event's owner check, so they are transitively covered: an
-- attendee can no longer own an event to hang children off.
-- ─────────────────────────────────────────────────────────────────────

-- Mirrors is_admin(): STABLE + SECURITY DEFINER so the policy can read
-- profiles without the caller needing select on the row.
create or replace function is_event_host()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists(
    select 1 from profiles
     where id = auth.uid()
       and user_type in ('event_director', 'admin')
  );
$$;

revoke execute on function is_event_host() from public;
grant execute on function is_event_host() to anon, authenticated;

drop policy if exists p_tournaments_write on tournaments;
create policy p_tournaments_write on tournaments for all
  using      (is_event_host() and (owner_id = auth.uid() or is_admin()))
  with check (is_event_host() and (owner_id = auth.uid() or is_admin()));

drop policy if exists p_events_write on events;
create policy p_events_write on events for all
  using      (is_event_host() and (owner_id = auth.uid() or is_admin()))
  with check (is_event_host() and (owner_id = auth.uid() or is_admin()));

-- ── 20260719000002_event_parent_tournament_gate.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- An event write must also be authorized against its PARENT tournament.
--
-- `p_events_write` validated the event's own `owner_id` but never asked
-- whether the caller may write the tournament the event hangs off. Both
-- halves are caller-supplied, so ED-B could INSERT an event with
-- owner_id = self and tournament_id = <ED-A's tournament> and the policy
-- was satisfied: the row is "yours", so it passed.
--
-- That is not cosmetic. `recalc_tournament_ratings` aggregates every
-- published review reachable via `events e where e.tournament_id =
-- <tournament>`, so an event grafted onto someone else's tournament
-- rolls its reviews into that tournament's `general_rating`,
-- `coach_rating`, `attendee_rating`, and every category average. One ED
-- could attach a poorly-reviewed event to a competitor's tournament and
-- drag their aggregate down; the victim can see the row (public read)
-- but cannot edit or remove it, because they don't own it.
--
-- The rule is simply: you may write an event only if you may write its
-- parent tournament.
--
--   ED-A  -> own tournament          : t.owner_id = auth.uid()  ✓
--   ED-B  -> ED-A's tournament       : denied                   ✓
--   admin -> anywhere                : is_admin()               ✓
--   ED    -> unclaimed admin-created : denied — claim it first, which
--            matches S1.1 and the parked claim-ownership model.
--
-- `tournament_id` is NOT NULL, so the EXISTS can be required
-- unconditionally without stranding parentless rows.
--
-- Ownership transfer still works: approve_claim_request is SECURITY
-- DEFINER and bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_events_write on events;
create policy p_events_write on events for all
  using (
    is_event_host()
    and (owner_id = auth.uid() or is_admin())
    and exists (
      select 1 from tournaments t
       where t.id = events.tournament_id
         and (t.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    is_event_host()
    and (owner_id = auth.uid() or is_admin())
    and exists (
      select 1 from tournaments t
       where t.id = events.tournament_id
         and (t.owner_id = auth.uid() or is_admin())
    )
  );

-- ── 20260719000003_definer_null_uid_guard.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- CRITICAL: six SECURITY DEFINER functions were bypassable by anon.
--
-- The guards are written
--
--     if not (is_admin() or <owner> = auth.uid()) then
--       raise exception 'not authorized' using errcode = '42501';
--     end if;
--
-- For anon, `auth.uid()` is NULL, so `<owner> = auth.uid()` evaluates to
-- NULL — not false. `false or NULL` is NULL, `not NULL` is NULL, and
-- `if NULL then` does not execute. Both guards fall through and the
-- function runs. Being SECURITY DEFINER (owned by a BYPASSRLS role), RLS
-- offers no backstop.
--
-- Verified against the local stack: an anon client holding nothing but
-- the public anon key called `delete_tournament` on a claimed tournament
-- and permanently destroyed it *and* its child events, with no error.
--
-- Why it stayed hidden: an AUTHENTICATED non-owner has a real
-- `auth.uid()`, so the comparison is false, the predicate is true, and
-- the exception raises correctly. `c2-definer-guards` tests exactly that
-- caller, so it passed. Only the NULL/anon case slipped through. It also
-- only bites `delete_tournament` on CLAIMED tournaments — for an
-- unclaimed one the preceding `v_owner is null and not is_admin()` guard
-- does fire — which is to say it bit the valuable rows only.
--
-- Reachable because 20260718000005's blanket function grants gave anon
-- EXECUTE on all six (the known "function-grant overreach", already
-- flagged in the backlog).
--
-- Two layers, because either alone leaves a gap — grants have been
-- re-widened by a blanket migration once already, and the guard is the
-- real boundary:
--
--   1. An explicit `auth.uid() is null` check at the top of each
--      function, matching the pattern apply_promo_to_review and
--      claim_promo already use correctly.
--   2. The ownership predicate rewritten with `is not true`, so a NULL
--      can never again read as "authorized" if someone edits the guard.
--
-- Then revoke EXECUTE from anon on all six — every one is a destructive
-- account/content operation that requires a session by definition.
-- ─────────────────────────────────────────────────────────────────────

create or replace function delete_event(target_event uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_tournament uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select tournament_id, owner_id
    into v_tournament, v_owner
    from events where id = target_event;
  if v_tournament is null then
    return;  -- already gone
  end if;
  if (is_admin() or v_owner = auth.uid()) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update reviews r set
    detached = true,
    event_id = null,
    snapshot_event_title      = e.title,
    snapshot_tournament_title = tr.title,
    snapshot_event_start      = e.start_date,
    snapshot_event_end        = e.end_date,
    snapshot_event_location   = e.location_formatted,
    snapshot_event_logo       = e.logo_url
  from events e
  left join tournaments tr on tr.id = e.tournament_id
  where r.event_id = target_event and e.id = target_event;

  delete from events where id = target_event;
  perform recalc_tournament_ratings(v_tournament);
end;
$$;

create or replace function delete_tournament(target_tournament uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  ev uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select owner_id into v_owner from tournaments where id = target_tournament;
  if v_owner is null and not is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if (is_admin() or v_owner = auth.uid()) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for ev in select id from events where tournament_id = target_tournament loop
    perform delete_event(ev);
  end loop;
  delete from tournaments where id = target_tournament;
end;
$$;

create or replace function anonymize_account(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if (is_admin() or auth.uid() = target_user) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update reviews  set anonymized = true, author_id = null where author_id = target_user;
  update comments set anonymized = true, author_id = null where author_id = target_user;
end;
$$;

create or replace function scrub_profile_identity(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if (is_admin() or auth.uid() = target_user) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update profiles
     set first_name = null,
         last_name = null,
         dob = null,
         user_gender = null,
         location_lat = null,
         location_lng = null,
         location_formatted = null,
         location_city = null,
         location_state_full = null,
         location_state_abbr = null,
         location_zip = null,
         location_place_id = null,
         distance_pref = null,
         organization_title = null,
         org_description = null,
         org_logo_url = null,
         profile_photo_url = null,
         blocked = true
   where id = target_user;
end;
$$;

create or replace function soft_delete_attendee(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if (is_admin() or auth.uid() = target_user) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform anonymize_account(target_user);
  delete from favorites       where user_id = target_user;
  delete from recently_viewed where user_id = target_user;
  delete from review_helpful  where user_id = target_user;
  delete from content_hidden  where user_id = target_user;
  perform scrub_profile_identity(target_user);
end;
$$;

create or replace function delete_ed_account(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare ev uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if (is_admin() or auth.uid() = target_user) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update events
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  update tournaments
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  for ev in
    select id from events
      where owner_id = target_user
        and created_by = target_user
  loop
    perform delete_event(ev);
  end loop;
  delete from tournaments
    where owner_id = target_user and created_by = target_user;
  delete from submitted_csvs where ed_id = target_user;
  perform anonymize_account(target_user);
  perform scrub_profile_identity(target_user);
end;
$$;

-- Layer 2: anon has no business calling any of these. Authenticated
-- keeps EXECUTE — the in-function guards scope it to owner/admin.
revoke execute on function delete_event(uuid)             from anon;
revoke execute on function delete_tournament(uuid)        from anon;
revoke execute on function anonymize_account(uuid)        from anon;
revoke execute on function scrub_profile_identity(uuid)   from anon;
revoke execute on function soft_delete_attendee(uuid)     from anon;
revoke execute on function delete_ed_account(uuid)        from anon;

-- ── 20260719000004_storage_buckets.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Supabase Storage buckets + RLS for the upload cutover (supersedes the
-- URL-field deferrals S1.2 and S3.1).
--
-- Defined in SQL so the demo-migrate pipeline (`supabase db push` after
-- green CI, S9.1) provisions them alongside the schema — buckets are
-- rows in storage.buckets, policies are RLS on storage.objects.
--
-- Three buckets, two ownership models:
--   event-images  PUBLIC   event logos, sponsor logos, gallery images
--   org-logos     PUBLIC   organization logos, profile photos
--   promo-csv     PRIVATE  coach-email CSVs (contain emails — never public)
--
-- Path convention: every object is keyed by the UPLOADER's user id as the
-- leading folder — `<auth.uid()>/<filename>`. Two reasons:
--   1. It sidesteps the chicken-and-egg of event-scoped keys: an event
--      logo is uploaded before the event row exists (saveEvent runs after
--      the upload), so the event id isn't available yet. The user id is.
--   2. It gives a dead-simple, robust ownership test —
--      `(storage.foldername(name))[1] = auth.uid()::text` — with no
--      cross-table lookup. A user may write only under their own folder;
--      a non-owner cannot write under someone else's; admin may write
--      anywhere. That is exactly the required guarantee ("owner/admin may
--      write only to their own paths; a non-owner cannot").
--
-- Server-side type + size limits live on the bucket (file_size_limit,
-- allowed_mime_types). These are enforced by the Storage API, not the
-- browser's file-picker `accept`, so a crafted client cannot bypass them.
--
-- NULL-safety: `auth.uid()` is NULL for anon, so the folder predicate is
-- NULL and the row is excluded — correct default-deny for RLS USING/CHECK
-- (unlike a plpgsql `if not (...)` guard, which the NULL would slip
-- through — see S10.3). is_admin() also returns false for anon.
-- ─────────────────────────────────────────────────────────────────────

-- ── Buckets ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-images', 'event-images', true,  10485760, array['image/png','image/jpeg']),
  ('org-logos',    'org-logos',    true,   5242880, array['image/png','image/jpeg']),
  ('promo-csv',    'promo-csv',    false,  2097152, array['text/csv'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Public read on the two public buckets ────────────────────────────
-- (The public CDN endpoint already serves public buckets without auth;
-- this covers the authenticated download/list API path too.)
create policy p_storage_public_read on storage.objects for select
  using (bucket_id in ('event-images', 'org-logos'));

-- ── Owner/admin write on the public image buckets ────────────────────
create policy p_storage_public_write on storage.objects for insert
  with check (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_public_update on storage.objects for update
  using (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_public_delete on storage.objects for delete
  using (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ── Private promo-csv: owner/admin only, no public read ──────────────
-- Same predicate for SELECT as for writes: reads require ownership or
-- admin, so anon and non-owners cannot download or even list. Signed
-- URLs (created server-side by the owner/admin, who hold SELECT) are the
-- retrieval path.
create policy p_storage_csv_read on storage.objects for select
  using (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_csv_write on storage.objects for insert
  with check (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_csv_update on storage.objects for update
  using (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_csv_delete on storage.objects for delete
  using (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ── 20260719000005_submitted_csv_host_gate.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Gate submitted_csvs writes on being an event host (sibling of S10.1).
--
-- `p_csv_rw` was `ed_id = auth.uid() or is_admin()` for ALL verbs —
-- ownership-only, no role predicate. `ed_id` is caller-supplied and the
-- table grants INSERT to `authenticated`, so an attendee could POST a
-- submitted_csvs row naming themselves as ed_id and dump arbitrary
-- addresses into `raw_emails` — a PII/spam injection straight into the
-- admin review queue. (They could not issue promo codes: p_promo_admin_write
-- is is_admin()-only. But the emails landing in the queue is the harm.)
-- Verified on the local stack: an attendee INSERT succeeded.
--
-- Additionally, the write policy never checked that the CSV's event
-- belongs to the caller — the same parent-authorization gap as S10.2.
-- The submitCsv server action does check it, but RLS is the boundary.
--
-- Split the single `for all` policy into verb-scoped policies:
--   SELECT  ed_id = auth.uid() or is_admin()            (unchanged)
--   INSERT  admin, OR an event host submitting for their OWN event
--   UPDATE  admin (reject/approve), OR host owner (defensive; no ED path
--           updates today, but keep it symmetric with delete)
--   DELETE  admin, OR host owner (the ED "cancel pending" path)
--
-- App write paths, for reference: submitCsv (ED INSERT, own premium
-- event), rejectSubmittedCsv / sendPromoEmails-approve (admin UPDATE),
-- cancelSubmittedCsv (ED DELETE, own pending).
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_csv_rw on submitted_csvs;

create policy p_csv_read on submitted_csvs for select
  using (ed_id = auth.uid() or is_admin());

create policy p_csv_insert on submitted_csvs for insert
  with check (
    is_admin()
    or (
      is_event_host()
      and ed_id = auth.uid()
      and exists (
        select 1 from events e
         where e.id = submitted_csvs.event_id
           and e.owner_id = auth.uid()
      )
    )
  );

create policy p_csv_update on submitted_csvs for update
  using (is_admin() or (is_event_host() and ed_id = auth.uid()))
  with check (is_admin() or (is_event_host() and ed_id = auth.uid()));

create policy p_csv_delete on submitted_csvs for delete
  using (is_admin() or (is_event_host() and ed_id = auth.uid()));

-- ── 20260719000006_submitted_csv_admin_only_update.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- submitted_csvs UPDATE is admin-only: drop the owner arm.
--
-- 20260719000005 kept a defensive owner arm on p_csv_update ("no ED
-- path updates today, but keep it symmetric with delete"). That arm is
-- itself a hole: `status` is the admin review verdict, and with the arm
-- in place an ED could PATCH their own row to status='approved' via
-- PostgREST, skipping admin review entirely (approved is rendered as
-- "Sent emails" in the ED dashboard, and the admin queue no longer
-- shows the row as pending).
--
-- A column-grant allow-list can't fix this: admin and ED both connect
-- as the `authenticated` Postgres role, so column privileges cannot
-- distinguish them — only RLS can. Status transitions belong to admins
-- (rejectSubmittedCsv, sendPromoEmails→approved); the ED lifecycle is
-- INSERT (submit) and DELETE (cancel while pending), both unchanged.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_csv_update on submitted_csvs;

create policy p_csv_update on submitted_csvs for update
  using (is_admin())
  with check (is_admin());

-- ── 20260719000007_save_event_graph.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Atomic saveEvent: one SECURITY DEFINER RPC per event graph (S9.3 rework).
--
-- The action persisted child collections (age groups, sponsors,
-- competition levels, surfaces, features, images, milestones) with
-- replace-all: delete every row, re-insert what the client sent. Since
-- the write-error pass a failed insert SURFACES — but the delete has
-- already landed, so the ED's collection is gone and must be re-entered.
-- Not data-silent, but not atomic.
--
-- `save_event_graph(p_event jsonb)` runs the base-row write + every
-- child replace-all inside one transaction: any raise rolls back the
-- whole graph, deletes included, so a late child failure leaves the
-- event exactly as it was before the call.
--
-- Entry guards (the hard-won patterns, all mandatory):
--   * `auth.uid() is null` → raise (S10.3 — never trust NULL to be false;
--     ownership predicates are written `(…) is not true` for the same
--     reason).
--   * authz mirrors p_events_write, not a parallel rule: is_event_host()
--     AND (owner or admin) on the existing row, AND write access to the
--     parent tournament — both the row's current parent (USING half) and
--     the final parent (WITH CHECK half) when they differ.
--   * `set search_path = public, pg_temp`.
--
-- Ownership on INSERT is computed HERE from the caller's role — never
-- taken from the payload (an RPC that trusted a caller-supplied owner_id
-- would reopen the S10.1 spoof): admin → owner_id null / claimed false
-- (claimable, S1.1); ED → owner_id self / claimed true.
--
-- The UPDATE arm never writes `id` (S9.2) nor the ownership columns; the
-- column set matches exactly what the action wrote through PostgREST —
-- being DEFINER this function bypasses the tier column grants, so it
-- must never touch is_premium / is_general_ad / premium_at / aggregates
-- (admin_set_premium / admin_set_general_ad stay the only path).
--
-- `lifecycle` is optional in the payload: absent/null = keep the current
-- value (the action's "update" intent), else 'draft' | 'active'.
--
-- Business validation (dates on publish, field checks, geo parsing)
-- stays in the action; the DB re-checks authz + enum/NOT NULL/check
-- constraints only. Errors: 42501 authz, P0001 validation, P0002 gone.
-- ─────────────────────────────────────────────────────────────────────

create or replace function save_event_graph(p_event jsonb)
  returns uuid
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_event_id uuid := nullif(p_event->>'id', '')::uuid;
  v_target_tournament uuid := nullif(p_event->>'tournament_id', '')::uuid;
  v_existing_tournament uuid;
  v_owner uuid;
  v_lifecycle event_lifecycle := nullif(p_event->>'lifecycle', '')::event_lifecycle;
  v_saved uuid;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if is_event_host() is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  v_is_admin := is_admin();

  if v_event_id is not null then
    select owner_id, tournament_id
      into v_owner, v_existing_tournament
      from events where id = v_event_id;
    if v_existing_tournament is null then
      raise exception 'event not found' using errcode = 'P0002';
    end if;
    if (v_is_admin or v_owner = v_uid) is not true then
      raise exception 'not authorized' using errcode = '42501';
    end if;
    -- p_events_write USING: write access to the row's current parent.
    if (v_is_admin or exists (
          select 1 from tournaments t
           where t.id = v_existing_tournament and t.owner_id = v_uid
        )) is not true then
      raise exception 'not authorized' using errcode = '42501';
    end if;
    v_target_tournament := coalesce(v_target_tournament, v_existing_tournament);
  elsif v_target_tournament is null then
    raise exception 'tournament required' using errcode = 'P0001';
  end if;

  -- p_events_write WITH CHECK: write access to the row's final parent.
  if (v_is_admin or exists (
        select 1 from tournaments t
         where t.id = v_target_tournament and t.owner_id = v_uid
      )) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_event_id is null then
    insert into events (
      tournament_id, owner_id, created_by, claimed,
      logo_url, title, website_url, host_club,
      start_date, end_date, registration_deadline, description,
      location_lat, location_lng, location_formatted, location_city,
      location_state_full, location_state_abbr, location_zip,
      location_place_id, num_teams_this_year, region, season_id,
      lifecycle, video_url, teams_this_year_url, teams_prev_year_url,
      registration_url, teams_attended_prev_year
    ) values (
      v_target_tournament,
      case when v_is_admin then null else v_uid end,
      v_uid,
      not v_is_admin,
      p_event->>'logo_url',
      p_event->>'title',
      p_event->>'website_url',
      p_event->>'host_club',
      nullif(p_event->>'start_date', '')::date,
      nullif(p_event->>'end_date', '')::date,
      nullif(p_event->>'registration_deadline', '')::date,
      p_event->>'description',
      nullif(p_event->>'location_lat', '')::double precision,
      nullif(p_event->>'location_lng', '')::double precision,
      p_event->>'location_formatted',
      p_event->>'location_city',
      p_event->>'location_state_full',
      p_event->>'location_state_abbr',
      p_event->>'location_zip',
      p_event->>'location_place_id',
      nullif(p_event->>'num_teams_this_year', '')::integer,
      nullif(p_event->>'region', '')::event_region,
      nullif(p_event->>'season_id', '')::uuid,
      coalesce(v_lifecycle, 'draft'),
      p_event->>'video_url',
      p_event->>'teams_this_year_url',
      p_event->>'teams_prev_year_url',
      p_event->>'registration_url',
      nullif(p_event->>'teams_attended_prev_year', '')::integer
    )
    returning id into v_saved;
  else
    -- `id` and the ownership columns are never in this SET list.
    update events set
      tournament_id = v_target_tournament,
      logo_url = p_event->>'logo_url',
      title = p_event->>'title',
      website_url = p_event->>'website_url',
      host_club = p_event->>'host_club',
      start_date = nullif(p_event->>'start_date', '')::date,
      end_date = nullif(p_event->>'end_date', '')::date,
      registration_deadline = nullif(p_event->>'registration_deadline', '')::date,
      description = p_event->>'description',
      location_lat = nullif(p_event->>'location_lat', '')::double precision,
      location_lng = nullif(p_event->>'location_lng', '')::double precision,
      location_formatted = p_event->>'location_formatted',
      location_city = p_event->>'location_city',
      location_state_full = p_event->>'location_state_full',
      location_state_abbr = p_event->>'location_state_abbr',
      location_zip = p_event->>'location_zip',
      location_place_id = p_event->>'location_place_id',
      num_teams_this_year = nullif(p_event->>'num_teams_this_year', '')::integer,
      region = nullif(p_event->>'region', '')::event_region,
      season_id = nullif(p_event->>'season_id', '')::uuid,
      lifecycle = coalesce(v_lifecycle, lifecycle),
      video_url = p_event->>'video_url',
      teams_this_year_url = p_event->>'teams_this_year_url',
      teams_prev_year_url = p_event->>'teams_prev_year_url',
      registration_url = p_event->>'registration_url',
      teams_attended_prev_year = nullif(p_event->>'teams_attended_prev_year', '')::integer
    where id = v_event_id;
    v_saved := v_event_id;
  end if;

  -- Child replace-alls. Element order carries sort_order where the
  -- table has one. Any failure below rolls back everything above.
  delete from event_age_groups where event_id = v_saved;
  insert into event_age_groups (event_id, team_gender, age, price, field_size)
  select v_saved,
         (g->>'team_gender')::team_gender,
         (g->>'age')::age_bracket,
         (g->>'price')::integer,
         (g->>'field_size')::field_size
    from jsonb_array_elements(coalesce(p_event->'age_groups', '[]'::jsonb)) g;

  delete from sponsors where event_id = v_saved;
  insert into sponsors (event_id, name, link, logo_url)
  select v_saved, s->>'name', s->>'link', s->>'logo_url'
    from jsonb_array_elements(coalesce(p_event->'sponsors', '[]'::jsonb)) s;

  delete from event_competition_levels where event_id = v_saved;
  insert into event_competition_levels (event_id, level)
  select v_saved, value::competition_level
    from jsonb_array_elements_text(coalesce(p_event->'competition_levels', '[]'::jsonb));

  delete from event_surfaces where event_id = v_saved;
  insert into event_surfaces (event_id, surface)
  select v_saved, value::surface
    from jsonb_array_elements_text(coalesce(p_event->'surfaces', '[]'::jsonb));

  delete from event_features where event_id = v_saved;
  insert into event_features (event_id, feature)
  select v_saved, value::event_feature
    from jsonb_array_elements_text(coalesce(p_event->'features', '[]'::jsonb));

  delete from event_images where event_id = v_saved;
  insert into event_images (event_id, url, sort_order)
  select v_saved, i.value, i.ordinality - 1
    from jsonb_array_elements_text(coalesce(p_event->'images', '[]'::jsonb))
         with ordinality i;

  delete from event_milestones where event_id = v_saved;
  insert into event_milestones (event_id, title, milestone_date, description, sort_order)
  select v_saved,
         m.value->>'title',
         nullif(m.value->>'milestone_date', '')::date,
         nullif(m.value->>'description', ''),
         m.ordinality - 1
    from jsonb_array_elements(coalesce(p_event->'milestones', '[]'::jsonb))
         with ordinality m;

  return v_saved;
end;
$$;

-- Functions default to EXECUTE for PUBLIC; the guards are the boundary,
-- but anon has no business reaching them at all (S10.3 layering).
revoke execute on function save_event_graph(jsonb) from public, anon;
grant execute on function save_event_graph(jsonb) to authenticated, service_role;

-- ── 20260719000008_admin_search_users_by_email.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Admin user search by email.
--
-- The admin /dashboard/users search filters profiles by name and
-- organization, but emails live in auth.users, which the app's
-- authenticated client cannot read — so an admin could not find the
-- account behind a support request that only quotes an email address.
--
-- `admin_search_users_by_email(term)` is the narrow bridge: SECURITY
-- DEFINER, admin-only, and it returns ONLY matching user ids — never
-- the emails themselves — so the page can fold the ids into its
-- existing profiles filter without a new PII read surface. Guards per
-- the house pattern (S10.3): explicit null-uid raise, `is not true`
-- role predicate, pinned search_path, EXECUTE revoked from
-- public/anon. Capped at 100 ids so a one-letter term can't balloon
-- the PostgREST `or()` URL.
-- ─────────────────────────────────────────────────────────────────────

create or replace function admin_search_users_by_email(term text)
  returns setof uuid
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if is_admin() is not true then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if term is null or length(trim(term)) = 0 then
    return;
  end if;
  return query
    select u.id
      from auth.users u
     where u.email ilike '%' || trim(term) || '%'
     limit 100;
end;
$$;

revoke execute on function admin_search_users_by_email(text) from public, anon;
grant execute on function admin_search_users_by_email(text) to authenticated, service_role;

-- ── 20260719000009_promo_email_eligibility.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Promo CSV eligibility pre-flight (S3.2 follow-through).
--
-- Spec §6.3: on the Send Emails popup, rows whose email belongs to an
-- existing NON-COACH account show "This email is already in use by an
-- account with a different user type and will be ignored." and are
-- auto-excluded (not re-addable). The check needs auth.users.email,
-- which the app's clients cannot read — and plumbing the service role
-- into the app is off the table. This SECURITY DEFINER RPC is the
-- narrow bridge instead.
--
-- Returns per-email eligibility ONLY — (email, status), where the
-- email column just echoes the caller's own input. No ids, names, or
-- any other account data cross the boundary; the worst an authorized
-- caller can learn is "this address has a non-coach account", which is
-- exactly what the popup must display.
--
--   no account                                → eligible  (invited to register)
--   attendee + role coach, not blocked        → eligible
--   attendee + role coach, blocked            → blocked
--   anything else (ED, admin, non-coach role,
--     or an auth user with no profile row)    → wrong-user-type
--
-- Statuses mirror the app's PreflightRow union. Guards per the house
-- pattern (S10.3): null-uid raise, `is_event_host() is not true` (the
-- popup is admin-side today, but the submitting ED may pre-flight
-- their own list), pinned search_path, EXECUTE revoked from
-- public/anon.
-- ─────────────────────────────────────────────────────────────────────

create or replace function promo_email_eligibility(p_emails text[])
  returns table(email text, status text)
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if is_event_host() is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Ordinality keeps the verdicts in the caller's input order.
  return query
    select e.value,
           case
             when u.id is null then 'eligible'
             when p.user_type = 'attendee' and p.role_title = 'coach'
               and p.blocked then 'blocked'
             when p.user_type = 'attendee' and p.role_title = 'coach'
               then 'eligible'
             else 'wrong-user-type'
           end
      from unnest(p_emails) with ordinality as e(value, ord)
      left join auth.users u on lower(u.email) = lower(trim(e.value))
      left join profiles p on p.id = u.id
     order by e.ord;
end;
$$;

revoke execute on function promo_email_eligibility(text[]) from public, anon;
grant execute on function promo_email_eligibility(text[]) to authenticated, service_role;

-- ── 20260719000010_drop_events_fts_pipeline.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Drop the events full-text-search pipeline (TURBOCHECK H-6, S10.13).
--
-- `events.search_document` + `search_vector`, their two GIN indexes,
-- `build_event_search_document()`, and the `t_events_search` trigger
-- recomputed on EVERY event insert/update — and nothing ever read
-- them. Real search is ILIKE over title/host_club/location_formatted
-- (`lib/events/search.ts`); repo-wide grep for the columns, tsquery
-- variants, and `textSearch` has zero app hits. Pure write
-- amplification + index bloat on the hottest table.
--
-- Removed per the dead-code convention; reversible via git if real
-- FTS is ever wired. Trigger → functions → indexes → columns, in
-- dependency order (build_event_search_document takes the `events`
-- row type, so it goes before the columns it names).
-- ─────────────────────────────────────────────────────────────────────

drop trigger if exists t_events_search on events;
drop function if exists trg_event_search();
drop function if exists build_event_search_document(events);
drop index if exists idx_events_search_vector;
drop index if exists idx_events_search_trgm;
alter table events drop column if exists search_vector;
alter table events drop column if exists search_document;

-- ── 20260719000011_promo_eligibility_email_cap.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- Cap promo_email_eligibility input at the CSV row cap (S10.15).
--
-- The RPC unnests + joins its whole input against auth.users in one
-- statement. Legitimate callers can never exceed 1000 addresses (the
-- app rejects CSVs over MAX_CSV_ROWS before this RPC ever runs), so an
-- oversize array is either a bug or someone using the definer bridge
-- as a bulk account-status oracle. Raise instead of truncating: a
-- silent trim would return a partial verdict the popup would render as
-- complete. 22023 = invalid_parameter_value.
--
-- Same body as 20260719000009 otherwise; the cap sits after the authz
-- gates so an unauthorized caller still learns nothing but "42501".
-- ─────────────────────────────────────────────────────────────────────

create or replace function promo_email_eligibility(p_emails text[])
  returns table(email text, status text)
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if is_event_host() is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 1000 then
    raise exception 'too many emails (max 1000)' using errcode = '22023';
  end if;

  -- Ordinality keeps the verdicts in the caller's input order.
  return query
    select e.value,
           case
             when u.id is null then 'eligible'
             when p.user_type = 'attendee' and p.role_title = 'coach'
               and p.blocked then 'blocked'
             when p.user_type = 'attendee' and p.role_title = 'coach'
               then 'eligible'
             else 'wrong-user-type'
           end
      from unnest(p_emails) with ordinality as e(value, ord)
      left join auth.users u on lower(u.email) = lower(trim(e.value))
      left join profiles p on p.id = u.id
     order by e.ord;
end;
$$;

-- ── 20260719000012_submitted_csv_delete_pending_only.sql ──────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- ED deletes of submitted_csvs only while pending (S10.16).
--
-- "Only pending submissions can be canceled" lived app-side only
-- (cancelSubmittedCsv); the S10.5 DELETE arm let an owning ED delete a
-- row in ANY status straight through PostgREST. Deleting an approved
-- row destroys the admin's review record and the promo_codes audit
-- anchor (promo_codes.submitted_csv_id cascades); deleting a rejected
-- row erases the rejection verdict. The verdict belongs to the admin,
-- so once one exists the row is admin-managed — same principle as the
-- S10.7 admin-only UPDATE.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_csv_delete on submitted_csvs;

create policy p_csv_delete on submitted_csvs for delete
  using (
    is_admin()
    or (is_event_host() and ed_id = auth.uid() and status = 'pending')
  );

-- ── 20260719000013_public_attendee_identity.sql ──────────────────────────────────────────
-- Public attendee identity — the public name rule is FIRST NAME + LAST
-- INITIAL ("Ashley M."). last_name itself is never exposed: the public
-- projection views compute upper(left(last_name, 1)) instead, and the
-- new public_attendees view backs the /attendees/[id] page header.
--
-- NOTE every drop/recreate here re-applies the 20260718000005 default
-- privileges (write grants to anon/authenticated), so each view gets an
-- explicit revoke — the H1 write-denial probes pin this.

-- 1. review_author_public gains last_initial.
drop view if exists review_author_public;
create view review_author_public
  with (security_invoker = false)
as
  select r.id  as review_id,
         case when r.anonymized then null else p.first_name end          as first_name,
         case when r.anonymized then null
              else upper(left(p.last_name, 1)) end                       as last_initial,
         case when r.anonymized then null else p.organization_title end  as organization_title,
         case when r.anonymized then null else p.profile_photo_url end   as profile_photo_url,
         r.reviewer_role,
         r.guru_review
  from reviews r
  left join profiles p on p.id = r.author_id;

-- 2. public_comment_authors gains last_initial.
drop view if exists public_comment_authors;
create view public_comment_authors
  with (security_invoker = false)
as
  select c.id  as comment_id,
         case when c.anonymized then null else p.first_name end         as first_name,
         case when c.anonymized then null
              else upper(left(p.last_name, 1)) end                      as last_initial,
         case when c.anonymized then null else p.organization_title end as organization_title,
         case when c.anonymized then null else p.org_logo_url end       as org_logo_url,
         case when c.anonymized then null else p.profile_photo_url end  as profile_photo_url,
         case when c.anonymized then null else p.user_type::text end    as user_type,
         c.author_id,
         c.is_owner_reply
  from comments c
  left join profiles p on p.id = c.author_id;

-- 3. Public attendee page header. Attendees only (EDs have /directors);
--    blocked users drop out so their page 404s. role_title and
--    organization_title ("Club Affiliation") are deliberately projected:
--    the public attendee page spec displays both.
create view public_attendees
  with (security_invoker = false)
as
  select p.id,
         p.first_name,
         upper(left(p.last_name, 1)) as last_initial,
         p.profile_photo_url,
         p.location_city,
         p.location_state_abbr,
         p.location_formatted,
         p.role_title,
         p.organization_title
  from profiles p
  where p.user_type = 'attendee'
    and not p.blocked;

grant select on review_author_public, public_comment_authors, public_attendees
  to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on review_author_public, public_comment_authors, public_attendees
  from anon, authenticated;

-- ── 20260720000001_public_event_owners_lean_projection.sql ──────────────────────────────────────────
-- Narrow public_event_owners to what its consumers actually read
-- (S11.8). The view exists for host-logo lookups keyed by
-- events.owner_id — every consumer selects id + org_logo_url +
-- profile_photo_url only. The host *identity* (name, org, contact)
-- renders from public_directors via getDirectorProfile, so the wider
-- projection (organization_title, org_description) was dead surface,
-- and last_name deliberately never ships here: an ED's full name is
-- public via public_directors, but an unused view is no place to
-- carry PII. first_name stays — the h1 write-denial harness requires
-- it in every probed projection.
--
-- NOTE the drop/recreate re-applies the 20260718000005 default
-- privileges (write grants to anon/authenticated), so the explicit
-- revoke below — the H1 write-denial probes pin this.

drop view if exists public_event_owners;
create view public_event_owners
  with (security_invoker = false)
as
  select p.id,
         p.first_name,
         p.org_logo_url,
         p.profile_photo_url
  from profiles p
  where p.user_type = 'event_director';

grant select on public_event_owners to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public_event_owners
  from anon, authenticated;

