-- =====================================================================
-- H4 — Neutralize the migrated-account email enumeration
--
-- `needs_password_setup(text)` returned TRUE iff an email belongs to a
-- migrated user who never signed in. Anon-callable, so an attacker
-- iterating a wordlist could enumerate every migrated account (~2,834
-- rows) and then hijack them via the neutral resetPasswordForEmail flow.
--
-- Fix:
--   • Revoke execute from `anon`. Only signed-in users can call it now
--     — a signed-in user checking their own account leaks nothing about
--     others.
--   • The login flow (app/(auth)/actions.ts) is updated in the same
--     commit to drop the pre-auth call and route users through a
--     generic "reset your password" nudge in the login error copy.
-- =====================================================================

revoke execute on function public.needs_password_setup(text) from anon;

comment on function public.needs_password_setup(text) is
  'Migrated-account probe. NEVER re-grant to anon: doing so enables account enumeration. Authenticated callers only.';
