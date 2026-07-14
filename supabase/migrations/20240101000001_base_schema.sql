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
