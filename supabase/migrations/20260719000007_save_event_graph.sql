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
