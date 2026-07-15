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
