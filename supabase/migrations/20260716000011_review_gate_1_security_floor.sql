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
