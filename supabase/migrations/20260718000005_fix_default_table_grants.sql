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
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

-- Retroactively fix all existing tables/sequences/functions.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

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

-- Sensitive functions stay revoked from public callers.
revoke execute on function rate_limit_touch(text,int) from public, anon, authenticated;
revoke execute on function recalc_event_ratings(uuid) from public, anon, authenticated;
revoke execute on function recalc_tournament_ratings(uuid) from public, anon, authenticated;
revoke execute on function trg_bump_tournament_counter() from public, anon, authenticated;
revoke execute on function admin_set_premium(uuid, boolean) from public, anon;
revoke execute on function admin_set_general_ad(uuid, boolean) from public, anon;
