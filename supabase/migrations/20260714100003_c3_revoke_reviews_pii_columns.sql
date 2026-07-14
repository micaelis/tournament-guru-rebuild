-- =====================================================================
-- C3 — Redact reviewer email / search key from public projection
--
-- The public-read policy on `reviews` lets anon SELECT any published row.
-- The row includes:
--   • user_email     — denormalized reviewer email (real PII)
--   • username_search — lowercase search key that enables enumeration
-- Neither is used by any current app query (grep confirms zero call
-- sites in app/ and lib/). Both were carried over from the Bubble
-- export as denormalized display fields.
--
-- Fix: column-level REVOKE. Because every existing SELECT in the app
-- lists columns explicitly, revoking these two doesn't break anything
-- for anon / authenticated. Service role keeps full access (needed for
-- admin PII surfaces if they're built later).
--
-- Note: we deliberately do NOT drop the columns. The data may still be
-- valuable for internal admin flows, and dropping would be irreversible.
-- If you want the data gone from disk entirely, add a follow-up
-- migration that `alter table reviews drop column user_email;`.
-- =====================================================================

revoke select (user_email, username_search) on public.reviews from anon;
revoke select (user_email, username_search) on public.reviews from authenticated;

-- Comment the columns so a future reader knows why the grants look off.
comment on column public.reviews.user_email is
  'PII — reviewer email carried over from Bubble. Revoked from anon/authenticated. Only readable via service_role.';
comment on column public.reviews.username_search is
  'Lowercase search key. Revoked from anon/authenticated to prevent user enumeration by display name. Only readable via service_role.';
