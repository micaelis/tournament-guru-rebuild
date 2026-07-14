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
