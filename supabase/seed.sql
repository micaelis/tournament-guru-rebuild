-- ============================================================================
-- Local seed — runs automatically on `supabase start` / `supabase db reset`.
-- Creates two fake "migrated" accounts (email exists, NO usable password,
-- never signed in here) so you can test the reset flow locally with zero real
-- user data. Reset emails are captured by Inbucket at http://localhost:54324.
-- ============================================================================

-- Insert straight into auth.users (we're the DB superuser locally). A NULL
-- encrypted_password is exactly the migrated state — password login can't
-- succeed. The on_auth_user_created trigger (from the auth_setup migration)
-- auto-creates the matching public.profiles row.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
   created_at, updated_at, confirmation_token, recovery_token,
   email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
   'authenticated', 'migrated1@local.test', null, now(), null,
   '{"provider":"email","providers":["email"]}', '{"full_name":"Casey Migrated"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
   'authenticated', 'migrated2@local.test', null, now(), null,
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dana Legacy"}',
   now(), now(), '', '', '', '')
on conflict (email) do nothing;

-- Flag them as pre-existing so needs_password_setup() returns true.
update public.profiles
   set existed_before = true,
       onboarding_complete = false
 where contact_email in ('migrated1@local.test', 'migrated2@local.test');

-- Sanity check (visible in `supabase db reset` output): both should be true.
do $$
declare r record;
begin
  for r in
    select email, public.needs_password_setup(email) as needs_reset
    from auth.users
    where email in ('migrated1@local.test', 'migrated2@local.test')
  loop
    raise notice 'seed: % -> needs_reset=%', r.email, r.needs_reset;
  end loop;
end $$;
