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
