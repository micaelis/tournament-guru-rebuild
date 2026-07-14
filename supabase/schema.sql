-- =====================================================================
-- Tournament Guru — consolidated schema (auto-generated).
--
-- DO NOT EDIT DIRECTLY. This file is produced by scripts/build-schema.sh
-- from supabase/migrations/. It is the concatenation of every migration
-- in chronological order, minus the demo-only seed migrations. Running
-- it against a fresh Postgres/Supabase project bootstraps the app's
-- final schema state (tables, RLS + policies, triggers, RPCs with
-- SET search_path, grants, indexes, and the small lookup seeds).
--
-- To regenerate:  bash scripts/build-schema.sh
-- To verify:      diff against `supabase db reset --local`'s pg_dump.
-- =====================================================================

-- ── 20240101000001_base_schema.sql ──────────────────────────────────────────
-- =====================================================================
-- Tournament Guru — Supabase / Postgres schema
-- Derived from the Bubble export (live fields only; deleted fields dropped)
-- Target: Next.js + Supabase (Postgres 15+, RLS on)
--
-- Conventions:
--   * snake_case everywhere (Bubble's "review-body" -> review_body)
--   * Bubble "list of X" relations -> proper FK / join tables, not arrays
--   * Bubble option sets -> Postgres enums
--   * auth handled by Supabase auth.users; app profile lives in public.profiles
--   * timestamps: created_at / updated_at on every table
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;      -- for geographic_address / distance search

-- ---------------------------------------------------------------------
-- ENUMS (from Bubble option_sets, live values only)
-- ---------------------------------------------------------------------
create type user_type        as enum ('admin','company','attendee','event_director');
create type customer_type     as enum ('coach','parent_spectator','team_manager');
create type user_gender       as enum ('male','female');
create type user_status       as enum ('active','blocked');
create type user_title        as enum ('event_director','club_director','event_admin');

create type gender            as enum ('both','boys','girls');
create type age_group         as enum ('u4','u5','u6','u7','u8','u9','u10','u11','u12','u13','u14','u15','u16','u17','u18','u19','u20');
create type age_label         as enum ('5v5','6v6','7v7','8v8','9v9','10v10','11v11');
create type competition_level as enum ('lowest','lower','middle','upper','highest');
create type field_surface     as enum ('turf','grass');
create type distance_pref     as enum ('no_limit','lt_150','lt_300','lt_450');
create type region_code       as enum ('I','II','III','IV');

create type event_status      as enum ('open','draft','canceled','concluded');
create type event_type        as enum ('free','premium');
create type additional_feature as enum ('free_wifi','restrooms','accessible','concessions','free_parking','pet_friendly','stay_to_play','synthetic_turf');

create type request_status     as enum ('pending','declined','approved');
create type promocode_status   as enum ('sent','active','applied','pending','expired','rejected');
create type transaction_type   as enum ('premium_event','general_ads');
create type flagged_reason     as enum ('other','profanity','solicitation','illicit_material');
create type notification_type  as enum (
  'ad_claim_request',        -- (ad) claim request
  'ed_request_status',       -- (ed) request status updated
  'at_review_like',          -- (at) review like
  'at_comment_reply',        -- (at) comment reply
  'ed_fav_event',            -- (ed) fav event
  'at_review_comment',       -- (at) review comment
  'ed_event_review'          -- (ed) event review
);
create type review_step       as enum ('step_1','step_2','step_3','completed');
create type onboarding_step    as enum ('first','second','finished');

-- ---------------------------------------------------------------------
-- PROFILES  (Bubble "user", 54 live fields -> normalized)
-- Auth lives in auth.users; this holds the app-level profile.
-- The three team_N_* slots are normalized into user_teams (see below).
-- ---------------------------------------------------------------------
create table profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  first_name            text,
  last_name             text,
  full_name             text,
  contact_email         text,
  profile_picture       text,        -- storage path
  dob                   date,
  gender                user_gender,
  user_type             user_type    not null default 'attendee',
  attendee_type         customer_type,
  title                 user_title,
  status                user_status  not null default 'active',
  guru_badge            boolean      not null default false,

  -- org / director fields
  org_logo              text,
  org_description       text,
  club_affiliation      text,

  -- billing
  stripe_id             text,

  -- onboarding & prefs
  onboarding_complete   boolean      not null default false,
  onboarding_step       onboarding_step default 'first',
  pref_distance         distance_pref,
  pref_competition      competition_level,
  location              geography(point,4326),
  location_text         text,
  pref_location         geography(point,4326),
  pref_location_text    text,

  -- denormalized counters (kept in sync by triggers / recalc jobs)
  total_events          integer default 0,
  total_premium_events  integer default 0,
  total_reviews         integer default 0,

  -- misc bubble flags
  existed_before        boolean default false,
  promo_invited         boolean default false,

  -- notification channel toggles (mirrors the Account > Notifications screen)
  email_fav_events      boolean default true,
  inapp_fav_events      boolean default true,
  email_review_likes    boolean default true,
  inapp_review_likes    boolean default true,
  email_event_reviews   boolean default true,
  inapp_event_reviews   boolean default true,
  email_review_comments boolean default true,
  inapp_review_comments boolean default true,
  email_comment_replies boolean default true,
  inapp_comment_replies boolean default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Preferred age groups (was pref_ages_boys / pref_ages_girls list fields)
create table profile_age_prefs (
  profile_id  uuid references profiles(id) on delete cascade,
  gender      gender not null,           -- boys | girls
  age         age_group not null,
  primary key (profile_id, gender, age)
);

-- User's teams (replaces team_1/2/3_* flat columns)
create table user_teams (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  slot        smallint not null check (slot between 1 and 3),
  gender      gender,
  age         age_group,
  level       competition_level,
  created_at  timestamptz not null default now(),
  unique (profile_id, slot)
);

-- Saved payment cards (Bubble "card" custom type)
create table cards (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  card_id     text,          -- Stripe card/payment-method id
  last4       text,
  card_brand  text,
  exp         text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SEASONS
-- ---------------------------------------------------------------------
create table seasons (
  id        uuid primary key default uuid_generate_v4(),
  title     text not null,
  start     date,
  "end"     date,
  inactive  boolean not null default false
);

-- ---------------------------------------------------------------------
-- EVENT PROFILES (recurring "tournament" parent that events belong to)
-- ---------------------------------------------------------------------
create table event_profiles (
  id             uuid primary key default uuid_generate_v4(),
  owner_id       uuid references profiles(id) on delete set null,
  owner_name     text,
  title          text not null,
  recurring      boolean not null default false,
  reviews        integer default 0,
  general_rating numeric(3,2) default 0,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- EVENTS (Bubble "event", 42 live fields)
-- ---------------------------------------------------------------------
create table events (
  id                    uuid primary key default uuid_generate_v4(),
  owner_id              uuid references profiles(id) on delete set null,
  event_profile_id      uuid references event_profiles(id) on delete set null,
  season_id             uuid references seasons(id) on delete set null,

  title                 text not null,
  tournament_title      text,
  event_title_abbrev    text,
  event_director        text,
  host_club             text,
  description           text,

  logo                  text,          -- storage path
  video                 text,
  photos                text[],        -- small fixed gallery; ok as array

  start_date            date,
  end_date              date,
  registration_deadline date,

  status                event_status not null default 'draft',
  premium               boolean not null default false,
  claimed               boolean not null default false,
  can_be_claimed        boolean not null default true,

  -- advertising flags
  general_ads           boolean not null default false,
  targeted_ads          boolean not null default false,

  -- location
  state                 text,          -- 2-letter; validated app-side against states list
  region                region_code,
  location              geography(point,4326),
  location_text         text,

  -- links
  website               text,
  this_year_website     text,
  previous_year_website text,
  registration_link     text,
  qr_code               text,

  -- denormalized ratings/counts (recalc job — see recalc_event backend wf)
  general_rating        numeric(3,2) default 0,
  coach_rating          numeric(3,2) default 0,
  attendee_rating       numeric(3,2) default 0,
  reviews               integer default 0,

  nr_teams_last_year    integer,
  reason_of_cancelation text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index events_status_idx   on events(status);
create index events_premium_idx  on events(premium);
create index events_state_idx    on events(state);
create index events_start_idx    on events(start_date);
create index events_location_idx on events using gist(location);

-- Event <-> option-set list relations (were Bubble "list of option")
create table event_ages (
  event_id uuid references events(id) on delete cascade,
  age      age_group not null,
  primary key (event_id, age)
);
create table event_genders (
  event_id uuid references events(id) on delete cascade,
  gender   gender not null,
  primary key (event_id, gender)
);
create table event_fields (
  event_id uuid references events(id) on delete cascade,
  surface  field_surface not null,
  primary key (event_id, surface)
);
create table event_features (
  event_id uuid references events(id) on delete cascade,
  feature  additional_feature not null,
  primary key (event_id, feature)
);
create table event_competition_levels (
  event_id uuid references events(id) on delete cascade,
  level    competition_level not null,
  primary key (event_id, level)
);

-- Favorites (was user.favorites list + event.favorited_by list — same relation)
create table favorites (
  profile_id uuid references profiles(id) on delete cascade,
  event_id   uuid references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, event_id)
);

-- Recently viewed (was a backend NewThing per view)
create table recently_viewed (
  profile_id uuid references profiles(id) on delete cascade,
  event_id   uuid references events(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (profile_id, event_id)
);

-- Age/pricing groups per event (Bubble age_group + target_group)
create table event_age_groups (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid not null references events(id) on delete cascade,
  age        age_group,
  gender     gender,
  label      age_label,
  price      numeric(10,2),
  age_index  integer
);

-- ---------------------------------------------------------------------
-- REVIEWS (Bubble "reviews", 30 live fields)
-- Multi-dimensional ratings kept as columns; that's how the UI shows them.
-- ---------------------------------------------------------------------
create table reviews (
  id                  uuid primary key default uuid_generate_v4(),
  event_id            uuid references events(id) on delete cascade,
  event_owner_id      uuid references profiles(id) on delete set null,
  author_id           uuid references profiles(id) on delete set null,

  -- denormalized author display (Bubble stored these flat on the review)
  username            text,
  username_search     text,
  user_email          text,
  user_club           text,
  user_role           text,

  review_title        text,
  review_body         text,

  team1               text,
  team2               text,
  team3               text,
  team_age            age_group,
  team_gender         gender,

  overall_rating      numeric(3,2),
  facilities_rating   numeric(3,2),
  fields_rating       numeric(3,2),
  management_rating   numeric(3,2),
  cost_value_rating   numeric(3,2),
  competition_rating  numeric(3,2),
  diversity_rating    numeric(3,2),

  published           boolean not null default false,
  guru_review         boolean not null default false,
  flagged             boolean not null default false,
  has_promo_code      boolean not null default false,
  promo_code          text,
  step                review_step default 'step_1',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index reviews_event_idx     on reviews(event_id);
create index reviews_published_idx on reviews(published);
create index reviews_author_idx    on reviews(author_id);

-- Review likes (was reviews.liked_by list.user)
create table review_likes (
  review_id  uuid references reviews(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, profile_id)
);

-- ---------------------------------------------------------------------
-- COMMENTS (threaded — reply_to_comment self-reference)
-- ---------------------------------------------------------------------
create table comments (
  id                uuid primary key default uuid_generate_v4(),
  review_id         uuid not null references reviews(id) on delete cascade,
  author_id         uuid references profiles(id) on delete set null,
  reply_to_comment  uuid references comments(id) on delete cascade,
  body              text not null,
  flagged           boolean not null default false,
  created_at        timestamptz not null default now()
);
create index comments_review_idx on comments(review_id);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type        notification_type not null,
  event_id    uuid references events(id) on delete cascade,
  review_id   uuid references reviews(id) on delete cascade,
  comment_id  uuid references comments(id) on delete cascade,
  seen        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notifications_recipient_idx on notifications(recipient_id, seen);

-- ---------------------------------------------------------------------
-- CLAIM / EVENT REQUESTS (director claims an event)
-- ---------------------------------------------------------------------
create table event_requests (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid references events(id) on delete cascade,
  requester_id uuid references profiles(id) on delete set null,
  phone      text,
  reason     text,
  message    text,
  status     request_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PROMO CODES + CSV import pipeline
-- ---------------------------------------------------------------------
create table submitted_csvs (
  id         uuid primary key default uuid_generate_v4(),
  uploader_id uuid references profiles(id) on delete set null,
  file_path  text,
  status     text,
  created_at timestamptz not null default now()
);

create table promo_codes (
  id           uuid primary key default uuid_generate_v4(),
  code         text not null unique,
  coach_id     uuid references profiles(id) on delete set null,
  review_id    uuid references reviews(id) on delete set null,
  email        text,
  is_new       boolean default true,
  event_id     uuid references events(id) on delete set null,
  csv_id       uuid references submitted_csvs(id) on delete set null,
  code_status  promocode_status not null default 'pending',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TRANSACTIONS (Stripe — premium / ads purchases)
-- ---------------------------------------------------------------------
create table transactions (
  id             uuid primary key default uuid_generate_v4(),
  profile_id     uuid references profiles(id) on delete set null,
  event_id       uuid references events(id) on delete set null,
  card_id        uuid references cards(id) on delete set null,
  transaction_id text,          -- Stripe charge/payment-intent id
  amount         numeric(10,2),
  card_brand     text,
  last4          text,
  type           transaction_type,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SPONSORS / ADS
-- ---------------------------------------------------------------------
create table sponsors (
  id        uuid primary key default uuid_generate_v4(),
  name      text,
  logo      text,
  link      text,
  event_id  uuid references events(id) on delete cascade,
  saved     boolean default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MODERATION
-- ---------------------------------------------------------------------
create table flagged_content (
  id             uuid primary key default uuid_generate_v4(),
  review_id      uuid references reviews(id) on delete cascade,
  comment_id     uuid references comments(id) on delete cascade,
  reason         flagged_reason,
  reason_comment text,
  seen           boolean not null default false,
  created_at     timestamptz not null default now()
);

create table reports (
  id         uuid primary key default uuid_generate_v4(),
  reporter_id uuid references profiles(id) on delete set null,
  event_id   uuid references events(id) on delete cascade,
  review_id  uuid references reviews(id) on delete cascade,
  message    text,
  flagged    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CONTACT REQUESTS (advertiser "Contact Us" form)
-- ---------------------------------------------------------------------
create table contact_requests (
  id               uuid primary key default uuid_generate_v4(),
  full_name        text,
  email            text,
  phone            text,
  company_name     text,
  website          text,
  additional_notes text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CMS-ish content (FAQ, testimonials)
-- ---------------------------------------------------------------------
create table faqs (
  id       uuid primary key default uuid_generate_v4(),
  title    text not null,
  content  text,
  sort     integer default 0
);

create table testimonials (
  id       uuid primary key default uuid_generate_v4(),
  name     text,
  title    text,
  photo    text,
  content  text,
  sort     integer default 0
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Roles implied by the data model:
--   attendee        — writes reviews/comments, favorites, own profile
--   event_director  — owns events, responds to reviews, claims events
--   company         — advertiser
--   admin           — full dashboard access (the 18-item dashboard_nav)
-- =====================================================================

-- helper: is the current user an admin?
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and user_type = 'admin'
  );
$$;

alter table profiles          enable row level security;
alter table events            enable row level security;
alter table reviews           enable row level security;
alter table comments          enable row level security;
alter table review_likes      enable row level security;
alter table favorites         enable row level security;
alter table notifications     enable row level security;
alter table event_requests    enable row level security;
alter table transactions      enable row level security;
alter table contact_requests  enable row level security;
alter table flagged_content   enable row level security;
alter table reports           enable row level security;

-- PROFILES ------------------------------------------------------------
create policy "profiles: self read"   on profiles for select using (auth.uid() = id or is_admin());
create policy "profiles: self update" on profiles for update using (auth.uid() = id);
create policy "profiles: self insert" on profiles for insert with check (auth.uid() = id);
-- public directory info (name, org, guru badge) is exposed via a VIEW, not the base table.

-- EVENTS --------------------------------------------------------------
-- anyone can read published/open events; owners & admins see their drafts
create policy "events: public read"
  on events for select
  using (status <> 'draft' or owner_id = auth.uid() or is_admin());
create policy "events: owner write"
  on events for update using (owner_id = auth.uid() or is_admin());
create policy "events: director insert"
  on events for insert
  with check (
    exists (select 1 from profiles p where p.id = auth.uid()
            and p.user_type in ('event_director','admin'))
  );
create policy "events: owner delete"
  on events for delete using (owner_id = auth.uid() or is_admin());

-- REVIEWS -------------------------------------------------------------
create policy "reviews: public read published"
  on reviews for select
  using (published = true or author_id = auth.uid() or is_admin());
create policy "reviews: author insert"
  on reviews for insert with check (author_id = auth.uid());
create policy "reviews: author update"
  on reviews for update using (author_id = auth.uid() or is_admin());
create policy "reviews: author delete"
  on reviews for delete using (author_id = auth.uid() or is_admin());

-- COMMENTS ------------------------------------------------------------
create policy "comments: public read"   on comments for select using (true);
create policy "comments: author insert"  on comments for insert with check (author_id = auth.uid());
create policy "comments: author modify"  on comments for update using (author_id = auth.uid() or is_admin());
create policy "comments: author delete"  on comments for delete using (author_id = auth.uid() or is_admin());

-- REVIEW LIKES --------------------------------------------------------
create policy "likes: read"   on review_likes for select using (true);
create policy "likes: self"   on review_likes for insert with check (profile_id = auth.uid());
create policy "likes: unlike" on review_likes for delete using (profile_id = auth.uid());

-- FAVORITES -----------------------------------------------------------
create policy "favorites: self read"   on favorites for select using (profile_id = auth.uid());
create policy "favorites: self insert" on favorites for insert with check (profile_id = auth.uid());
create policy "favorites: self delete" on favorites for delete using (profile_id = auth.uid());

-- NOTIFICATIONS -------------------------------------------------------
create policy "notifications: recipient read"   on notifications for select using (recipient_id = auth.uid() or is_admin());
create policy "notifications: recipient update" on notifications for update using (recipient_id = auth.uid());

-- EVENT REQUESTS ------------------------------------------------------
create policy "requests: involved read"
  on event_requests for select
  using (requester_id = auth.uid()
         or exists (select 1 from events e where e.id = event_id and e.owner_id = auth.uid())
         or is_admin());
create policy "requests: create" on event_requests for insert with check (requester_id = auth.uid());

-- TRANSACTIONS --------------------------------------------------------
create policy "transactions: self read" on transactions for select using (profile_id = auth.uid() or is_admin());
-- inserts happen server-side via service role (Stripe webhook), so no insert policy for anon/auth.

-- CONTACT REQUESTS ----------------------------------------------------
create policy "contact: anyone submit" on contact_requests for insert with check (true);
create policy "contact: admin read"    on contact_requests for select using (is_admin());

-- MODERATION ----------------------------------------------------------
create policy "flagged: admin read"  on flagged_content for select using (is_admin());
create policy "reports: create"       on reports for insert with check (reporter_id = auth.uid());
create policy "reports: admin read"   on reports for select using (is_admin());

-- =====================================================================
-- updated_at trigger
-- =====================================================================
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger t_profiles_touch before update on profiles
  for each row execute function touch_updated_at();
create trigger t_events_touch before update on events
  for each row execute function touch_updated_at();
create trigger t_reviews_touch before update on reviews
  for each row execute function touch_updated_at();

-- =====================================================================
-- NOTES FOR THE BUILD
--  * Public directory data (author name/club/badge on published reviews,
--    event owner display name) should be served through SECURITY DEFINER
--    views or the denormalized text columns already on reviews/events,
--    so RLS on profiles can stay locked to self+admin.
--  * event.general_rating / coach_rating / attendee_rating / reviews and
--    profile.total_* are denormalized. Recompute them in a Postgres
--    function triggered on reviews insert/update/delete — this replaces the
--    Bubble backend workflows recalc_event_data (cmUGs) and recalc_review (cmUHA).
--  * Distance search: use ST_DWithin(location, pref_location, meters) — replaces
--    Bubble's distance option set with real geo math.
-- =====================================================================

-- ── 20240101000002_schema_additions.sql ──────────────────────────────────────────
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

-- ── 20240101000003_auth_setup.sql ──────────────────────────────────────────
-- ============================================================================
-- Tournament Guru — Auth & Onboarding SETUP (DDL only — NOT a data migration)
-- ----------------------------------------------------------------------------
-- This script defines functions, a trigger, RLS policies, and GRANTs. It moves
-- NO user data and touches NO existing rows. It is idempotent — safe to re-run
-- any time, including after edits (e.g. the section 4 GRANTs). Running it does
-- NOT re-run the 2,834-user data import; the two are completely separate.
--
-- Apply via Supabase → SQL Editor (or `supabase db execute`).
--
-- It does three things:
--   1. Auto-creates a public.profiles row whenever a new auth user signs up
--      (email/password OR Google OR Facebook), so the app never has to insert
--      it client-side (which RLS + email-confirmation timing make fragile).
--   2. Adds needs_password_setup(email) — lets the login screen detect the
--      2,834 migrated users (existed_before = true, never signed in) and route
--      them to password reset instead of showing "wrong password".
--   3. Locks down public.user_teams with RLS so a user can only read/write
--      their own teams (the table shipped with no RLS at all).
-- ============================================================================

-- ── 1. Profile auto-creation on signup ─────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, contact_email, full_name,
    onboarding_complete, onboarding_step, user_type, status
  )
  values (
    new.id,
    new.email,
    -- OAuth providers put the display name in different metadata keys
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    false,
    'first',
    'attendee',
    'active'
  )
  on conflict (id) do nothing;  -- migrated users already have a profile row
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 2. Migrated-user detection for the login screen ────────────────────────
-- Migrated accounts exist in auth.users with an unusable password. On their
-- first login signInWithPassword returns a generic "Invalid credentials" that
-- is indistinguishable from a real typo. This function lets the app tell the
-- difference. It returns TRUE only for a migrated user who has never signed in,
-- so it leaks nothing about ordinary accounts (which always get the generic
-- "incorrect email or password" message).
create or replace function public.needs_password_setup(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select u.last_sign_in_at, p.existed_before
    into v
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(p_email)
  limit 1;

  return coalesce(v.existed_before, false) and v.last_sign_in_at is null;
end;
$$;

grant execute on function public.needs_password_setup(text) to anon, authenticated;


-- ── 3. Row-level security for user_teams ───────────────────────────────────
alter table public.user_teams enable row level security;

drop policy if exists "user_teams: owner all" on public.user_teams;
create policy "user_teams: owner all"
  on public.user_teams
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);


-- ── 4. Table privileges for the authenticated role ─────────────────────────
-- profiles and user_teams deny the anon role at the GRANT level (deliberate —
-- they're private). RLS only takes effect once the role holds the base
-- privilege, so grant the logged-in (authenticated) role exactly what the app
-- needs. Row access is still fully constrained by the RLS policies above /
-- the existing "profiles: self *" policies — a user can only touch their own
-- rows. anon is intentionally NOT granted anything here.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_teams to authenticated;

-- ── 20240101000004_advertiser_grants_and_faq_seed.sql ──────────────────────────────────────────
-- =====================================================================
-- Advertiser pages: Contact Us + FAQ
-- The base schema created `contact_requests` and `faqs` with RLS/policies
-- for contact_requests, but the anon/authenticated roles were never granted
-- the underlying table privileges (and faqs had no RLS/read policy). Without
-- the GRANTs, PostgREST returns 42501 "permission denied for table" even
-- though the RLS policy would allow the row. This migration fixes that and
-- seeds the advertiser FAQ set.
-- =====================================================================

-- ── contact_requests ──
-- RLS policy "contact: anyone submit" already permits the insert; grant the
-- table privilege so the anon role can exercise it. (No select grant: reads
-- stay admin-only via "contact: admin read".)
grant insert on public.contact_requests to anon, authenticated;

-- ── faqs ── public, read-only content.
alter table public.faqs enable row level security;
drop policy if exists "faqs: public read" on public.faqs;
create policy "faqs: public read" on public.faqs for select using (true);
grant select on public.faqs to anon, authenticated;

-- ── Seed the advertiser FAQ set ──
-- Re-runnable: deletes any prior copy of these rows (matched by title), then
-- re-inserts. A fresh production project seeds cleanly, and re-applying the
-- migration never duplicates. Scoped by title so it leaves any other FAQs
-- untouched.
delete from public.faqs
where title in (
  'Who can advertise on your platform?',
  'How do I get started?',
  'Can you help with ad design?',
  'What ad formats do you support?',
  'How long will my ad be shown?',
  'Can I choose where my ad appears?',
  'Can I see how my ad is performing?'
);

insert into public.faqs (title, content, sort) values
  ('Who can advertise on your platform?',
   'Any registered business or individual offering a product or service relevant to our audience is welcome to apply.',
   1),
  ('How do I get started?',
   'Simply register your company and fill out our contact form. We''ll reach out to you to discuss the details and next steps.',
   2),
  ('Can you help with ad design?',
   'Yes! If you don''t have a ready-made banner, our design team can create one for you based on the information you provide.',
   3),
  ('What ad formats do you support?',
   'We currently support static horizontal banners, with a word limit and minimum resolution (e.g. 720px wide). Full specifications will be shared during setup.',
   4),
  ('How long will my ad be shown?',
   'The duration depends on the agreement — we offer flexible packages from short-term promos to long-running campaigns.',
   5),
  ('Can I choose where my ad appears?',
   'Absolutely. We''ll work with you to place your ad in the most relevant sections of the app — ensuring it reaches the right audience at the right time.',
   6),
  ('Can I see how my ad is performing?',
   'Yes — you''ll get access to a dashboard with live metrics: impressions, clicks, likes, and more. We also send you weekly performance reports.',
   7);

-- ── 20240101000005_contact_source.sql ──────────────────────────────────────────
-- =====================================================================
-- contact_requests.source
-- Distinguish where a contact request came from — the general "Contact"
-- page vs. the advertiser "Contact Us" page — so inquiries can be triaged
-- apart. Free-text (no check constraint) so new surfaces can add their own
-- value later; existing rows and any un-tagged insert default to 'general'.
-- Idempotent so it's safe to re-apply on a fresh production project.
-- =====================================================================

alter table public.contact_requests
  add column if not exists source text not null default 'general';

-- ── 20240101000006_public_directory_views.sql ──────────────────────────────────────────
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

-- ── 20240101000007_event_search_rpc.sql ──────────────────────────────────────────
-- =====================================================================
-- Tournament Guru — Find Events / Search page RPCs
-- The single canonical search entry point for the /events discovery page.
-- Builds directly on the elastic search infra from migration 000002
-- (search_vector tsvector + search_document trigram) and adds:
--   * all the page's filters (age / gender / level / surface / region / dates
--     / open-only), applied against the real join tables + enum columns
--   * sort (recommended / date / rating / teams)
--   * pagination + a total_count window so the UI can page the full set
--   * per-row lat/lng extracted from the PostGIS `location` point (mostly
--     NULL today — the map lights up automatically as geocoding lands)
--   * host org logo via the existing event_host_logos SECURITY DEFINER view
--
-- SECURITY INVOKER (default): the events "public read" RLS policy already
-- limits anon to status <> 'draft'; we also hard-filter it here. The join
-- tables carry no RLS, and host logos come through the granted view — so no
-- privilege escalation is needed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- search_events_page — paged, filtered, ranked event search.
-- All array params are "match ANY of" (multi-select). NULL/empty = no filter.
-- ---------------------------------------------------------------------
create or replace function public.search_events_page(
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
      -- keyword: full-text (whole words + expanded state/region names) OR
      -- trigram fuzzy fallback (partials / typos). Empty query = match all.
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
      -- date range OVERLAP: keep events whose window intersects [start,end]
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
    array(select a.age::text   from event_ages a               where a.event_id = c.id order by a.age)   as ages,
    array(select g.gender::text from event_genders g           where g.event_id = c.id order by g.gender) as genders,
    array(select l.level::text from event_competition_levels l where l.event_id = c.id order by l.level)  as levels,
    array(select fs.surface::text from event_fields fs         where fs.event_id = c.id order by fs.surface) as surfaces,
    c.total_count
  from counted c
  order by
    -- active sort first; every non-selected branch yields NULL and is pushed
    -- last, so the chosen column drives the ordering, then sensible fallbacks.
    (case when p_sort = 'date'   then c.start_date     end) asc  nulls last,
    (case when p_sort = 'rating' then c.general_rating end) desc nulls last,
    (case when p_sort = 'teams'  then c.nr_teams_last_year end) desc nulls last,
    (case when p_sort = 'recommended' then c.premium end) desc nulls last,
    (case when p_sort = 'recommended' then c.rank    end) desc nulls last,
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
-- get_event_facets — the distinct filter values ACTUALLY present in public
-- (non-draft) events, so the UI populates chips from real data rather than a
-- hardcoded list. Ordering/labelling is applied client-side.
-- ---------------------------------------------------------------------
create or replace function public.get_event_facets()
returns json
language sql
stable
as $$
  select json_build_object(
    'ages', coalesce((
      select array_agg(distinct a.age::text)
      from event_ages a join events e on e.id = a.event_id
      where e.status <> 'draft'), '{}'),
    'genders', coalesce((
      select array_agg(distinct g.gender::text)
      from event_genders g join events e on e.id = g.event_id
      where e.status <> 'draft'), '{}'),
    'levels', coalesce((
      select array_agg(distinct l.level::text)
      from event_competition_levels l join events e on e.id = l.event_id
      where e.status <> 'draft'), '{}'),
    'surfaces', coalesce((
      select array_agg(distinct f.surface::text)
      from event_fields f join events e on e.id = f.event_id
      where e.status <> 'draft'), '{}'),
    'regions', coalesce((
      select array_agg(distinct e.region::text)
      from events e
      where e.status <> 'draft' and e.region is not null), '{}')
  );
$$;

grant execute on function public.get_event_facets() to anon, authenticated;

-- ── 20240101000008_event_search_featured_first.sql ──────────────────────────────────────────
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

-- ── 20240101000009_event_recency_window.sql ──────────────────────────────────────────
-- =====================================================================
-- Visibility rule: only show FUTURE events, or events that concluded at most
-- 28 days ago. Applied to the discovery surfaces (search + facets). An event's
-- "effective end" is end_date, or start_date when end_date is null; events with
-- no dates at all are kept (can't be judged stale).
--
-- Self-contained: redefines both functions to their FINAL form (featured-first,
-- teams column, recency window), so applying this migration yields the correct
-- state regardless of whether 000008 was applied.
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
      -- Recency window: future, or concluded within the last 28 days.
      and (coalesce(e.end_date, e.start_date) is null
           or coalesce(e.end_date, e.start_date) >= current_date - interval '28 days')
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

-- Facets reflect only the events that are actually visible under the window.
create or replace function public.get_event_facets()
returns json
language sql
stable
as $$
  with visible as (
    select * from events e
    where e.status <> 'draft'
      and (coalesce(e.end_date, e.start_date) is null
           or coalesce(e.end_date, e.start_date) >= current_date - interval '28 days')
  )
  select json_build_object(
    'ages', coalesce((
      select array_agg(distinct a.age::text)
      from event_ages a join visible e on e.id = a.event_id), '{}'),
    'genders', coalesce((
      select array_agg(distinct g.gender::text)
      from event_genders g join visible e on e.id = g.event_id), '{}'),
    'levels', coalesce((
      select array_agg(distinct l.level::text)
      from event_competition_levels l join visible e on e.id = l.event_id), '{}'),
    'surfaces', coalesce((
      select array_agg(distinct f.surface::text)
      from event_fields f join visible e on e.id = f.event_id), '{}'),
    'regions', coalesce((
      select array_agg(distinct e.region::text)
      from visible e where e.region is not null), '{}')
  );
$$;

grant execute on function public.get_event_facets() to anon, authenticated;

-- (skipped demo seed: 20240101000010_refresh_event_dates_for_demo.sql)

-- ── 20240101000011_event_review_counts_rpc.sql ──────────────────────────────────────────
-- ---------------------------------------------------------------------
-- Per-event, per-type review COUNTS for the featured-event cards.
--
-- The events table denormalizes the three *ratings* (general/coach/attendee)
-- and a single *total* review count, but not the per-type counts. This RPC
-- returns them for a batch of events, using the EXACT same coach/attendee
-- split that recalc_event_ratings() uses (see 20240101000002), so the counts
-- line up 1:1 with coach_rating / attendee_rating:
--   * coach    = published reviews whose user_role matches '%coach%'
--   * attendee = every other published review (parents, spectators, managers…)
--
-- SECURITY DEFINER with a locked search_path: only aggregates published
-- reviews (already publicly readable via RLS), returns nothing else.
-- ---------------------------------------------------------------------
create or replace function public.get_event_review_counts(p_event_ids uuid[])
returns table (
  event_id         uuid,
  coach_reviews    integer,
  attendee_reviews integer,
  total_reviews    integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.event_id,
    count(*) filter (where r.user_role ilike '%coach%')::int as coach_reviews,
    count(*) filter (
      where r.user_role is null or r.user_role not ilike '%coach%'
    )::int as attendee_reviews,
    count(*)::int as total_reviews
  from public.reviews r
  where r.published = true
    and r.event_id = any(p_event_ids)
  group by r.event_id;
$$;

grant execute on function public.get_event_review_counts(uuid[]) to anon, authenticated;

-- ── 20240101000012_search_logging.sql ──────────────────────────────────────────
-- ---------------------------------------------------------------------
-- Popular searches — logging + aggregation.
--
-- The hero's "Popular" chips were hardcoded because nothing recorded what
-- people actually search for. This adds:
--   * search_queries : an append-only log of submitted search terms
--   * get_popular_searches() : the top-N terms over a recent window
--
-- Privacy: rows are write-only for the public (insert policy, no select
-- policy), so raw terms are never publicly readable — only the aggregated
-- top-N is exposed, via a SECURITY DEFINER function.
-- ---------------------------------------------------------------------
create table if not exists public.search_queries (
  id         uuid primary key default uuid_generate_v4(),
  term       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_queries_created on public.search_queries(created_at desc);

alter table public.search_queries enable row level security;

-- Anyone may log a search (bounded length); nobody may read the raw rows.
create policy "search_queries: anyone log"
  on public.search_queries for insert
  with check (char_length(btrim(term)) between 2 and 60);

-- Top normalized search terms over a recent window. Grouped case-insensitively;
-- the most-typed original casing is shown.
create or replace function public.get_popular_searches(
  p_limit int default 3,
  p_days  int default 120
)
returns table (term text, hits bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (array_agg(btrim(term) order by 1))[1] as term,
    count(*) as hits
  from public.search_queries
  where created_at >= now() - make_interval(days => greatest(1, p_days))
    and char_length(btrim(term)) between 2 and 40
  group by lower(btrim(term))
  order by count(*) desc, 1 asc
  limit greatest(1, least(10, p_limit));
$$;

grant execute on function public.get_popular_searches(int, int) to anon, authenticated;

-- ── 20240101000013_event_premium_at.sql ──────────────────────────────────────────
-- Track when an event actually went featured/premium, so the homepage Featured
-- strip can order by "most recently featured" rather than by event creation
-- date. Historically we only had `premium boolean` + `created_at/updated_at`,
-- which meant a long-standing event that was just upgraded to premium sorted as
-- if it were old.
--
-- Strategy:
--   * add a nullable `premium_at timestamptz`
--   * backfill existing premium rows from `updated_at` (their last-modified
--     time is the best available proxy for "when it went featured")
--   * stamp it automatically whenever `premium` flips on going forward
--
-- After this migration every premium row has a non-null `premium_at`, so the
-- app can simply order by it (with `updated_at` as a defensive tiebreak).

alter table events add column if not exists premium_at timestamptz;

-- Backfill: empty featured-date → last modified date.
update events
   set premium_at = updated_at
 where premium = true
   and premium_at is null;

-- Stamp premium_at the moment an event becomes premium (on insert-as-premium or
-- a false/null → true transition). A manually-supplied premium_at is preserved,
-- and un-featuring keeps the historical stamp rather than clearing it.
create or replace function stamp_premium_at() returns trigger
  language plpgsql as $$
begin
  if NEW.premium = true
     and (TG_OP = 'INSERT' or OLD.premium is distinct from true) then
    NEW.premium_at = coalesce(NEW.premium_at, now());
  end if;
  return NEW;
end;
$$;

drop trigger if exists t_events_stamp_premium_at on events;
create trigger t_events_stamp_premium_at
  before insert or update of premium on events
  for each row execute function stamp_premium_at();

-- Partial index supporting the featured-strip ordering.
create index if not exists idx_events_premium_at
  on events (premium_at desc)
  where premium = true;

-- ── 20240101000014_event_directors_directory.sql ──────────────────────────────────────────
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

-- (skipped demo seed: 20240101000015_seed_bubble_recent_reviews.sql)

-- ── 20240101000016_states_filter.sql ──────────────────────────────────────────
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

-- ── 20240101000017_director_profile.sql ──────────────────────────────────────────
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

-- ── 20240101000018_seed_event_demographics.sql ──────────────────────────────────────────
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

-- ── 20260714100001_c1_lockdown_profiles_reviews_write_columns.sql ──────────────────────────────────────────
-- =====================================================================
-- C1 — Privilege escalation lockdown on profiles + reviews updates
--
-- The old policies allowed any authenticated user to UPDATE *any* column on
-- their own row. That let a user run:
--   update profiles set user_type='admin' where id=auth.uid();
-- and be admin. Same shape on reviews let authors flip published /
-- guru_review / flagged on their own reviews.
--
-- Fix: column-level GRANTs. Column privileges are checked BEFORE RLS by
-- Postgres, so this is a hard cap independent of any USING/WITH CHECK
-- adjustments. The RLS policies stay unchanged (they still scope rows to
-- self) — this migration only narrows *which columns* the authenticated
-- role may write.
--
-- Admin / service-side flows keep working:
--   * service_role bypasses column privileges and RLS.
--   * No app code currently writes the revoked columns from an
--     authenticated session; verified across app/(auth|onboarding),
--     app/dashboard, lib/supabase/queries.ts.
--   * Future admin flows for guru_badge, user_type, etc. should go
--     through a SECURITY DEFINER RPC that checks is_admin() in its body.
--
-- Rollback: `grant update on public.profiles to authenticated;`
--           `grant update on public.reviews  to authenticated;`
-- =====================================================================

-- ── profiles ────────────────────────────────────────────────────────
-- Wipe any existing column grants so we're not layering on top of a
-- broad `grant update on profiles to authenticated`.
revoke update on public.profiles from authenticated;

-- Narrow allow-list. Every column in this set is either set by the user
-- via onboarding (see app/(onboarding)/actions.ts:126-146) or via the
-- dashboard account editor (app/dashboard/account/actions.ts:38-58).
-- Notably absent: user_type, status, title, guru_badge, org_logo,
-- stripe_id, existed_before, promo_invited, total_events,
-- total_premium_events, total_reviews, location, pref_location,
-- pref_location_text, created_at.
grant update (
  first_name,
  last_name,
  full_name,
  contact_email,
  attendee_type,
  club_affiliation,
  org_description,
  location_text,
  gender,
  dob,
  pref_distance,
  pref_competition,
  onboarding_complete,
  onboarding_step,
  email_fav_events,
  inapp_fav_events,
  email_review_likes,
  inapp_review_likes,
  email_event_reviews,
  inapp_event_reviews,
  email_review_comments,
  inapp_review_comments,
  email_comment_replies,
  inapp_comment_replies,
  updated_at
) on public.profiles to authenticated;

-- ── reviews ─────────────────────────────────────────────────────────
-- Same idea. Revoked columns: published (moderation gate), guru_review
-- (admin badge), flagged (moderation), has_promo_code / promo_code
-- (system), step (Bubble workflow bookkeeping), event_id / author_id /
-- event_owner_id / username_search / user_email (identity + PII —
-- covered in C3).
revoke update on public.reviews from authenticated;

grant update (
  review_title,
  review_body,
  team1,
  team2,
  team3,
  team_age,
  team_gender,
  overall_rating,
  facilities_rating,
  fields_rating,
  management_rating,
  cost_value_rating,
  competition_rating,
  diversity_rating,
  username,
  user_club,
  user_role
) on public.reviews to authenticated;

-- ── belt-and-braces: policy WITH CHECK on profiles ──────────────────
-- Even if a future migration widens the column grants above, the
-- policy prevents a user from writing certain values into user_type.
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id or is_admin())
  with check (
    -- Admin bypass so an admin can promote users through service_role
    -- OR via a future admin RPC that flips role to postgres.
    is_admin()
    or (
      auth.uid() = id
      -- A regular user cannot land as admin or event_director via a
      -- self update. Onboarding writes attendee_type (coach / parent /
      -- team_manager) which is a separate column.
      and user_type in ('attendee', 'company')
    )
  );

-- ── belt-and-braces: policy WITH CHECK on reviews ───────────────────
drop policy if exists "reviews: author update" on public.reviews;
create policy "reviews: author update"
  on public.reviews for update
  using (author_id = auth.uid() or is_admin())
  with check (
    is_admin()
    or (
      author_id = auth.uid()
      -- Author cannot self-publish (moderation gate), self-award the
      -- Guru badge, or clear a flag placed by moderators.
      and published = (select r.published from public.reviews r where r.id = reviews.id)
      and guru_review = (select r.guru_review from public.reviews r where r.id = reviews.id)
      and flagged = (select r.flagged from public.reviews r where r.id = reviews.id)
    )
  );

-- ── 20260714100002_c2_enable_rls_cards_promo_codes.sql ──────────────────────────────────────────
-- =====================================================================
-- C2 — Enable RLS on `cards` and `promo_codes`
--
-- These tables were missing `alter table … enable row level security`
-- entirely. Supabase does not grant `anon/authenticated` any default
-- privileges on the `public` schema, but any future permissive grant
-- (or a misconfigured project) would expose Stripe card metadata and
-- secret promo redemption codes to every logged-in user. Defense-in-
-- depth requires RLS to be on with narrow policies.
--
-- Neither table has any app-side INSERT/UPDATE path today. Both are
-- populated exclusively via server-side flows using the service role
-- (Stripe webhooks for `cards`, CSV import for `promo_codes`). Service
-- role bypasses RLS.
-- =====================================================================

-- ── cards ───────────────────────────────────────────────────────────
alter table public.cards enable row level security;

-- Owner may read their own saved cards. No write policy: mutations
-- happen server-side through the Stripe webhook running as service_role.
create policy "cards: self read"
  on public.cards for select
  using (profile_id = auth.uid() or is_admin());

-- Owner may delete their own saved card (Account → Saved payment methods).
create policy "cards: self delete"
  on public.cards for delete
  using (profile_id = auth.uid());

-- ── promo_codes ─────────────────────────────────────────────────────
alter table public.promo_codes enable row level security;

-- Only the coach whose codes these are (or an admin) can list them.
-- Regular users never see promo_codes; the review-side promo redemption
-- path reads `has_promo_code` on the review itself.
create policy "promo_codes: owner read"
  on public.promo_codes for select
  using (coach_id = auth.uid() or is_admin());

-- Neither authenticated nor anon can INSERT / UPDATE / DELETE from the
-- app. Bulk operations live in server-side flows using service_role.

-- ── 20260714100003_c3_revoke_reviews_pii_columns.sql ──────────────────────────────────────────
-- =====================================================================
-- C3 — Redact reviewer email / search key from public projection
--
-- The public-read policy on `reviews` lets anon SELECT any published row.
-- The row includes:
--   • user_email     — denormalized reviewer email (real PII)
--   • username_search — lowercase search key that enables enumeration
-- Neither is used by any current app query (grep confirms zero call
-- sites in app/ and lib/). Both were carried over from the Bubble
-- export as denormalized display fields.
--
-- Fix: column-level REVOKE. Because every existing SELECT in the app
-- lists columns explicitly, revoking these two doesn't break anything
-- for anon / authenticated. Service role keeps full access (needed for
-- admin PII surfaces if they're built later).
--
-- Note: we deliberately do NOT drop the columns. The data may still be
-- valuable for internal admin flows, and dropping would be irreversible.
-- If you want the data gone from disk entirely, add a follow-up
-- migration that `alter table reviews drop column user_email;`.
-- =====================================================================

revoke select (user_email, username_search) on public.reviews from anon;
revoke select (user_email, username_search) on public.reviews from authenticated;

-- Comment the columns so a future reader knows why the grants look off.
comment on column public.reviews.user_email is
  'PII — reviewer email carried over from Bubble. Revoked from anon/authenticated. Only readable via service_role.';
comment on column public.reviews.username_search is
  'Lowercase search key. Revoked from anon/authenticated to prevent user enumeration by display name. Only readable via service_role.';

-- ── 20260714100004_c5_drop_contact_email_from_directors_rpc.sql ──────────────────────────────────────────
-- =====================================================================
-- C5 — Stop leaking director emails through `get_event_directors`
--
-- The RPC (migration 20240101000014) is granted to `anon` and returned
-- `contact_email` in the row projection. The About Us grid never
-- displayed it, but a plain `curl` against `/rpc/get_event_directors`
-- with `p_limit=1000` scraped every event director's email.
--
-- Fix: drop the column from the return signature.
-- `pin_order` still needs to test emails to keep the curated three at
-- the top of the grid, and that comparison lives inside the DEFINER
-- function's body — it is not returned to the caller.
-- =====================================================================

drop function if exists public.get_event_directors(int, int);

create or replace function public.get_event_directors(
  p_limit  int default 12,
  p_offset int default 0
)
returns table (
  id                uuid,
  display_name      text,
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
      p.profile_picture,
      p.org_logo,
      p.club_affiliation,
      count(distinct e.id)::int as event_count,
      coalesce(sum(e.reviews), 0)::int as total_reviews,
      case
        when coalesce(sum(e.reviews) filter (where e.reviews > 0), 0) > 0 then (
          sum(coalesce(e.general_rating, 0) * e.reviews)
            filter (where e.reviews > 0)
          / nullif(sum(e.reviews) filter (where e.reviews > 0), 0)
        )::numeric(3,2)
        else 0::numeric(3,2)
      end as avg_rating,
      -- Curated pinning: the three directors below are surfaced first on
      -- the About Us grid in this exact order, regardless of activity.
      -- The email comparison happens inside the DEFINER function; the
      -- email itself is not returned to the caller.
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

-- ── 20260714100005_h4_needs_password_setup_revoke_anon.sql ──────────────────────────────────────────
-- =====================================================================
-- H4 — Neutralize the migrated-account email enumeration
--
-- `needs_password_setup(text)` returned TRUE iff an email belongs to a
-- migrated user who never signed in. Anon-callable, so an attacker
-- iterating a wordlist could enumerate every migrated account (~2,834
-- rows) and then hijack them via the neutral resetPasswordForEmail flow.
--
-- Fix:
--   • Revoke execute from `anon`. Only signed-in users can call it now
--     — a signed-in user checking their own account leaks nothing about
--     others.
--   • The login flow (app/(auth)/actions.ts) is updated in the same
--     commit to drop the pre-auth call and route users through a
--     generic "reset your password" nudge in the login error copy.
-- =====================================================================

revoke execute on function public.needs_password_setup(text) from anon;

comment on function public.needs_password_setup(text) is
  'Migrated-account probe. NEVER re-grant to anon: doing so enables account enumeration. Authenticated callers only.';

-- ── 20260714100006_h11_search_path_hygiene.sql ──────────────────────────────────────────
-- =====================================================================
-- H11 — `SET search_path` hygiene on remaining functions + view intent
--
-- All SECURITY DEFINER functions were already hardened with
-- `set search_path = public` when they were written. The remaining
-- INVOKER functions (rating recalc, search-document builder, trigger
-- helpers) were not, which means a hostile session `search_path` could
-- (in principle) shadow a `public.` reference during execution and
-- redirect a call. Impact is low today because these run under the
-- caller's role and RLS-protected tables would still block writes, but
-- pinning search_path costs nothing and is a Supabase best practice.
--
-- Also asserts `security_invoker = false` on the two directory views,
-- so their bypass-RLS intent survives future Postgres upgrades that
-- change the view-behavior default.
-- =====================================================================

-- ── Rating recalculation and its trigger ────────────────────────────
alter function public.recalc_event_ratings(uuid)
  set search_path = public, pg_temp;

alter function public.trg_reviews_recalc()
  set search_path = public, pg_temp;

-- ── Search document builder and its triggers ────────────────────────
alter function public.build_event_search_document(public.events)
  set search_path = public, pg_temp;

alter function public.trg_event_search()
  set search_path = public, pg_temp;

alter function public.trg_refresh_event_search_from_child()
  set search_path = public, pg_temp;

-- ── Premium timestamp stamper ───────────────────────────────────────
alter function public.stamp_premium_at()
  set search_path = public, pg_temp;

-- ── Public search RPCs (INVOKER) ────────────────────────────────────
alter function public.search_events_page(
  text, text[], text[], text[], text[], text[], date, date, boolean, text, int, int
) set search_path = public, pg_temp;

alter function public.get_event_facets()
  set search_path = public, pg_temp;

-- ── Directory views — pin DEFINER semantics explicitly ──────────────
-- These views live specifically to expose a narrow safe projection of
-- profiles data (`org_logo`, `user_type`, `attendee_type`) that RLS on
-- the base table would block. The bypass-RLS behavior is DELIBERATE.
-- Postgres 15+ defaults new views to `security_invoker = true`; if a
-- future recreate or environment upgrade flips that default, these
-- views would suddenly return zero rows. Pin the intent.
alter view public.review_author_badges set (security_invoker = false);
alter view public.event_host_logos    set (security_invoker = false);

-- ── 20260714100007_h5_rate_limits.sql ──────────────────────────────────────────
-- =====================================================================
-- H5 — DB-side burst cap on public writes
--
-- App layer (lib/rate-limit.ts) enforces a per-IP burst limit at the
-- Vercel edge. This is the second line: a *global* per-minute cap on
-- the two writable anon endpoints, so a distributed flood can't push
-- more than N inserts/min into the table regardless of IP diversity.
--
-- The cap is intentionally generous (well above expected legit
-- traffic) — its job is to catch runaway abuse, not to shape normal
-- use. Real per-user limits belong in the app layer.
--
-- Emits SQLSTATE '22023' (invalid_parameter_value) which PostgREST
-- surfaces as HTTP 400 — the app already treats any error as "logging
-- best-effort".
-- =====================================================================

-- Rolling per-minute counter. `bucket` is the table name; `window_start`
-- is the truncated minute; `hits` is the count so far.
create table if not exists public.rate_limit_windows (
  bucket        text        not null,
  window_start  timestamptz not null,
  hits          int         not null default 0,
  primary key (bucket, window_start)
);

-- Only service_role inspects/prunes this table.
alter table public.rate_limit_windows enable row level security;
-- (No policies — the trigger runs under the invoker but bypasses via
-- the DEFINER function below.)

-- Prune helper. Deletes windows older than an hour. Idempotent, safe
-- to run from a scheduled job (pg_cron / Supabase Scheduler) — or just
-- ignored; the table stays tiny either way (~one row per (table,
-- minute) so at most a few thousand rows per hour).
create or replace function public.rate_limit_prune()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limit_windows
  where window_start < now() - interval '1 hour';
$$;

-- Global per-minute cap enforcer. Bumps the current-minute counter
-- for a bucket and raises if it would exceed `p_limit`.
create or replace function public.rate_limit_touch(
  p_bucket text,
  p_limit  int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window  timestamptz := date_trunc('minute', now());
  v_hits    int;
begin
  insert into public.rate_limit_windows (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = rate_limit_windows.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'rate limit exceeded for %', p_bucket
      using errcode = '22023';
  end if;
end;
$$;

-- Anon can call the touch function (that's the whole point — it's the
-- gate). It only writes to the counter table.
grant execute on function public.rate_limit_touch(text, int) to anon, authenticated;

-- ── Search log burst cap ────────────────────────────────────────────
-- 1000 inserts/minute globally. Legit hero-search traffic sits at
-- <100/min even during a marketing spike.
create or replace function public.trg_search_queries_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.rate_limit_touch('search_queries', 1000);
  return new;
end;
$$;

drop trigger if exists t_search_queries_rate_limit on public.search_queries;
create trigger t_search_queries_rate_limit
  before insert on public.search_queries
  for each row execute function public.trg_search_queries_rate_limit();

-- ── Contact requests burst cap ──────────────────────────────────────
-- 60 inserts/minute globally. Real traffic is a handful per day.
create or replace function public.trg_contact_requests_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.rate_limit_touch('contact_requests', 60);
  return new;
end;
$$;

drop trigger if exists t_contact_requests_rate_limit on public.contact_requests;
create trigger t_contact_requests_rate_limit
  before insert on public.contact_requests
  for each row execute function public.trg_contact_requests_rate_limit();

-- ── 20260714100008_h1_event_host_contact_columns.sql ──────────────────────────────────────────
-- =====================================================================
-- H1 — Real backing for the event-page "Contact host" modal
--
-- The modal used to console.info its payload and flip a `sent` state —
-- users saw "Message queued" but nothing landed anywhere. This adds the
-- two columns the modal action needs so a submission persists into
-- `contact_requests`:
--
--   • event_id     — the event the visitor is asking about (nullable
--                    to keep advertiser / general submissions valid).
--   • event_title  — snapshot of the event's title at submit time, so
--                    admins can identify the request even if the event
--                    is later deleted or renamed.
--
-- `contact_requests` was chosen over `event_requests` because the
-- public event page does not require sign-in and `event_requests`
-- policies require `requester_id = auth.uid()`. `contact_requests`
-- already accepts anon submissions (with the H5 rate-limit trigger as
-- the abuse gate).
-- =====================================================================

alter table public.contact_requests
  add column if not exists event_id uuid references public.events(id) on delete set null,
  add column if not exists event_title text;

-- Index for admin queries filtering by event.
create index if not exists idx_contact_requests_event on public.contact_requests(event_id);

-- ── 20260714100009_m12_popular_searches_use_mode.sql ──────────────────────────────────────────
-- =====================================================================
-- M12 — Pick the most-typed casing for popular searches
--
-- `get_popular_searches` grouped case-insensitively but the displayed
-- term was `(array_agg(btrim(term) order by 1))[1]` — i.e. the
-- alphabetically-first casing. A single early "SOCCER" pinned the
-- display to all-caps even after 500 users typed "soccer". Switch to
-- `mode() within group (order by btrim(term))` so the term that was
-- actually typed most often wins the display slot.
-- =====================================================================

create or replace function public.get_popular_searches(
  p_limit int default 3,
  p_days  int default 120
)
returns table (term text, hits bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    mode() within group (order by btrim(term)) as term,
    count(*) as hits
  from public.search_queries
  where created_at >= now() - make_interval(days => greatest(1, p_days))
    and char_length(btrim(term)) between 2 and 40
  group by lower(btrim(term))
  order by count(*) desc, 1 asc
  limit greatest(1, least(10, p_limit));
$$;

grant execute on function public.get_popular_searches(int, int) to anon, authenticated;

-- ── 20260714100010_m16_notification_opt_in_defaults.sql ──────────────────────────────────────────
-- =====================================================================
-- M16 — Notification preferences default OFF; existing rows opted out
--
-- The 10 notification-preference columns on `profiles` defaulted to
-- TRUE, and every existing row inherits that default. That means every
-- user in the current DB (including real ones carried over from the
-- Bubble migration) is silently opted in to every channel, without
-- ever having explicitly consented.
--
-- Rule from the operator: no user receives email unless they explicitly
-- opted in. This migration:
--   1. Flips the column defaults from TRUE to FALSE so new signups
--      land opted-out.
--   2. Bulk-updates every existing row to FALSE. Users who genuinely
--      want notifications now flip the switches themselves via
--      /dashboard/account.
--
-- Safe to re-run: the column default flip is idempotent; the update
-- writes FALSE regardless of prior value.
-- =====================================================================

alter table public.profiles
  alter column email_fav_events      set default false,
  alter column inapp_fav_events      set default false,
  alter column email_review_likes    set default false,
  alter column inapp_review_likes    set default false,
  alter column email_event_reviews   set default false,
  alter column inapp_event_reviews   set default false,
  alter column email_review_comments set default false,
  alter column inapp_review_comments set default false,
  alter column email_comment_replies set default false,
  alter column inapp_comment_replies set default false;

update public.profiles
   set email_fav_events      = false,
       inapp_fav_events      = false,
       email_review_likes    = false,
       inapp_review_likes    = false,
       email_event_reviews   = false,
       inapp_event_reviews   = false,
       email_review_comments = false,
       inapp_review_comments = false,
       email_comment_replies = false,
       inapp_comment_replies = false;

-- ── 20260714100011_m11_us_states_ka_typo.sql ──────────────────────────────────────────
-- =====================================================================
-- M11 — Remove the `KA` typo from us_states (Kansas is `KS`)
--
-- The us_states lookup migration (000002:146) inserted `('KA','Kansas')`
-- alongside the correct `('KS','Kansas')` at line 138. `KA` is not a
-- USPS code, so no real event matches it, but if a form typo ever
-- writes `KA` into `events.state` the facet list will surface it as a
-- valid option. Idempotent.
-- =====================================================================

delete from public.us_states where code = 'KA';

-- ── 20260714100012_p1_get_platform_stats.sql ──────────────────────────────────────────
-- =====================================================================
-- P1 — Compute homepage stats without fetching every row
--
-- `getStats` (lib/supabase/queries.ts) computed
--   tournamentsCount = new Set(select event_profile_id from events …).size
-- which meant every homepage load fetched all non-draft event rows just
-- to count distinct grouping keys client-side. This RPC returns the
-- three homepage stats in one round-trip and computes the distinct
-- count in Postgres where it belongs.
-- =====================================================================

create or replace function public.get_platform_stats()
returns table (
  events_count      bigint,
  reviews_count     bigint,
  tournaments_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.events  where status <> 'draft')  as events_count,
    (select count(*) from public.reviews where published = true)   as reviews_count,
    (select count(distinct event_profile_id) from public.events
       where status <> 'draft' and event_profile_id is not null)   as tournaments_count;
$$;

grant execute on function public.get_platform_stats() to anon, authenticated;

-- ── 20260714110001_r1_rate_limit_touch_lockdown.sql ──────────────────────────────────────────
-- =====================================================================
-- R1 — Close the rate_limit_touch self-DoS
--
-- Hostile-review finding: `rate_limit_touch(text, int)` was granted
-- EXECUTE to `anon` and `authenticated`. Any anon key holder could:
--
--   1. Poison the counter for a given bucket by calling
--      `select rate_limit_touch('search_queries', 999999999)` 1001x —
--      the counter for the current minute ticks past 1000, and the
--      very next legitimate insert into `search_queries` fires the
--      trigger (limit=1000) which now raises. Bucket is DoS'd for the
--      rest of the minute. Repeat forever. Same for `contact_requests`.
--   2. Insert arbitrary bucket names to grow `rate_limit_windows`
--      without bound.
--
-- Fix: revoke EXECUTE from `anon` and `authenticated`. The trigger
-- functions (`trg_search_queries_rate_limit`, `trg_contact_requests_
-- rate_limit`) are themselves SECURITY DEFINER, so their internal
-- `perform rate_limit_touch(...)` call runs with the trigger's own
-- privileges — not the invoker's. Revoking the direct grant closes
-- the exploit without breaking the triggers.
--
-- Defense in depth: also whitelist `p_bucket` inside the function so
-- even if a future migration re-grants EXECUTE, arbitrary bucket names
-- and inflated limits are rejected.
-- =====================================================================

revoke execute on function public.rate_limit_touch(text, int) from anon;
revoke execute on function public.rate_limit_touch(text, int) from authenticated;
-- PUBLIC gets EXECUTE on every new function by default; also strip it.
revoke execute on function public.rate_limit_touch(text, int) from public;

create or replace function public.rate_limit_touch(
  p_bucket text,
  p_limit  int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window  timestamptz := date_trunc('minute', now());
  v_hits    int;
begin
  -- Only the two buckets the triggers use are valid. Any other value
  -- is a bug or an attack; refuse loudly.
  if p_bucket not in ('search_queries', 'contact_requests') then
    raise exception 'rate_limit_touch: unknown bucket %', p_bucket
      using errcode = '22023';
  end if;

  -- Cap the limit range so a caller can't ask for effectively unlimited
  -- headroom. The real per-bucket ceilings live in the trigger callers
  -- (search_queries → 1000, contact_requests → 60); accepting anything
  -- outside a sane range is a defense-in-depth signal that the caller
  -- is not one of our triggers.
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'rate_limit_touch: p_limit out of range: %', p_limit
      using errcode = '22023';
  end if;

  insert into public.rate_limit_windows (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = rate_limit_windows.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'rate limit exceeded for %', p_bucket
      using errcode = '22023';
  end if;
end;
$$;

comment on function public.rate_limit_touch(text, int) is
  'DB-side burst counter. Callable only from the two trigger functions on search_queries / contact_requests (both SECURITY DEFINER). Never re-grant EXECUTE to anon/authenticated — direct-caller access enables a self-DoS by poisoning the per-minute counter.';

-- ── 20260714110002_r2_reviews_insert_column_lockdown.sql ──────────────────────────────────────────
-- =====================================================================
-- R2 — Lock down reviews INSERT the same way UPDATE was locked in C1
--
-- Hostile-review finding: C1 (`20260714100001`) revoked/re-granted
-- UPDATE on `reviews` column-by-column so authors can't flip
-- `published`, `guru_review`, or `flagged` on their own reviews. But
-- the INSERT side was untouched — `reviews: author insert` policy only
-- checks `author_id = auth.uid()`, and Supabase's Data API grants
-- INSERT-on-all-tables to `authenticated` by default. An attacker with
-- an authenticated JWT could:
--
--   insert into reviews (author_id, event_id, review_title, review_body,
--                        published, guru_review, flagged, overall_rating)
--   values (auth.uid(), '<any event id>', 'Fake', '...', true, true, false, 5);
--
-- Result: self-published review with the "Guru" badge, no moderation.
--
-- Fix — same shape as C1:
--   1. Revoke INSERT on reviews from authenticated / PUBLIC.
--   2. Re-grant INSERT column-by-column, excluding the moderation
--      fields (published, guru_review, flagged) and system fields
--      (has_promo_code, promo_code, step, username_search, user_email,
--      event_owner_id — the trigger sets that from the event).
--   3. Belt-and-braces: the insert policy now WITH CHECKs the
--      moderation defaults so even a widened grant can't create a
--      published/guru-branded row.
--
-- Service role bypasses both grants and RLS, so admin flows keep
-- working (that's how a moderator publishes/flags on server actions).
-- =====================================================================

revoke insert on public.reviews from authenticated;
revoke insert on public.reviews from public;

-- Author-safe insertable columns. Explicitly OMIT: `id` (default),
-- `event_owner_id` (denormalized from events.owner_id — set by a
-- trigger if any, or by the caller from lookup; safer to exclude from
-- authenticated insert and let it default null / be set server-side),
-- `published`, `guru_review`, `flagged`, `has_promo_code`, `promo_code`,
-- `step`, `username_search`, `user_email`, `created_at`, `updated_at`.
grant insert (
  event_id,
  author_id,
  username,
  user_club,
  user_role,
  review_title,
  review_body,
  team1, team2, team3,
  team_age, team_gender,
  overall_rating,
  facilities_rating,
  fields_rating,
  management_rating,
  cost_value_rating,
  competition_rating,
  diversity_rating
) on public.reviews to authenticated;

-- Tighten the insert policy: even if a future migration widens the
-- column grants, moderation fields must land at their defaults.
drop policy if exists "reviews: author insert" on public.reviews;
create policy "reviews: author insert"
  on public.reviews for insert
  with check (
    author_id = auth.uid()
    -- Moderation fields must be at their table-default values on
    -- creation. `published` starts false (moderator publishes later);
    -- `guru_review` is set by admin promotion; `flagged` starts false.
    and (published is null or published = false)
    and (guru_review is null or guru_review = false)
    and (flagged is null or flagged = false)
  );

comment on policy "reviews: author insert" on public.reviews is
  'Author may insert reviews as themselves. Moderation fields (published/guru_review/flagged) are pinned to their defaults; column-level INSERT grants also exclude those columns as belt-and-braces.';

-- ── 20260714110003_r3_scope_admin_match_in_definer_surfaces.sql ──────────────────────────────────────────
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

