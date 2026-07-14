-- ============================================================================
-- Tournament Guru — STAGING seed (fake "migrated" test accounts)
-- ----------------------------------------------------------------------------
-- ⚠️  STAGING ONLY. Never run against production.
--
-- Purpose: turn a couple of ordinary test accounts into the exact state a
-- migrated user is in — email exists, but no usable password and never signed
-- in here — so you can verify the "please reset your password" login flow
-- WITHOUT using any of the 2,834 real users' data.
--
-- HOW TO USE:
--   1. In the staging Supabase dashboard → Authentication → Users → "Add user",
--      create these two accounts (any temporary password; you'll erase it).
--      Use plus-addressed real inboxes you control, so the reset email arrives:
--        e.g.  youraddress+migrated1@gmail.com
--              youraddress+migrated2@gmail.com
--   2. Put those exact emails in the array below.
--   3. Run this whole script in the staging SQL Editor.
--   4. Confirm the verification query at the bottom shows needs_reset = true.
-- ============================================================================

do $$
declare
  -- 👇 EDIT THESE to the two emails you created in step 1.
  emails text[] := array[
    'youraddress+migrated1@gmail.com',
    'youraddress+migrated2@gmail.com'
  ];
begin
  -- Erase the password (NULL = "no usable password", exactly like a migrated
  -- account) and clear any sign-in history so they look brand-new here.
  update auth.users
     set encrypted_password = null,
         last_sign_in_at     = null
   where email = any(emails);

  -- Flag them as pre-existing (this is what needs_password_setup() checks) and
  -- make sure they still owe onboarding.
  update public.profiles
     set existed_before      = true,
         onboarding_complete  = false
   where id in (select id from auth.users where email = any(emails));
end $$;

-- ── Verify: every seeded account should report needs_reset = true ──
select
  u.email,
  (u.encrypted_password is null) as password_erased,
  u.last_sign_in_at,
  p.existed_before,
  public.needs_password_setup(u.email) as needs_reset
from auth.users u
join public.profiles p on p.id = u.id
where u.email = any(array[
  'youraddress+migrated1@gmail.com',
  'youraddress+migrated2@gmail.com'
]);
