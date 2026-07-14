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
-- Fix: revoke table-level SELECT from anon/authenticated first (a
-- column-level REVOKE alone is a no-op when the role holds a broad
-- table grant — this bit us on the first staging push and was repaired
-- by migration R8, but on a fresh bootstrap the ordering here already
-- gets it right), then grant SELECT column-by-column omitting the two
-- PII columns and the promo/system fields.
--
-- Service role bypasses grants entirely — retains full read for admin
-- surfaces.
-- =====================================================================

revoke select on public.reviews from anon;
revoke select on public.reviews from authenticated;

-- Anon/authenticated-safe reviews columns. `user_email`,
-- `username_search`, `has_promo_code`, `promo_code`, `step` are the
-- deliberate omissions.
grant select (
  id,
  event_id,
  event_owner_id,
  author_id,
  username,
  user_club,
  user_role,
  review_title,
  review_body,
  team1, team2, team3,
  team_age, team_gender,
  overall_rating,
  facilities_rating,
  fields_rating,
  management_rating,
  cost_value_rating,
  competition_rating,
  diversity_rating,
  published,
  guru_review,
  flagged,
  created_at,
  updated_at
) on public.reviews to anon, authenticated;

comment on column public.reviews.user_email is
  'PII — reviewer email carried over from Bubble. Revoked from anon/authenticated at the column level after the table-level SELECT is stripped. Only readable via service_role.';
comment on column public.reviews.username_search is
  'Lowercase search key. Revoked from anon/authenticated to prevent user enumeration by display name. Only readable via service_role.';
