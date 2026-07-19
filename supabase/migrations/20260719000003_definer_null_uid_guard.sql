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
