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
