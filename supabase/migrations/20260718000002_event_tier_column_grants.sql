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
