-- =====================================================================
-- R8 — Repair C3: column-level REVOKE is a no-op if table-level SELECT
--       is still granted. Redo the C3 lockdown correctly.
--
-- Post-push verification found `select user_email from reviews` still
-- returned rows (with user_email present) via the anon key. Root
-- cause: `revoke select (col) on ... from anon` doesn't remove access
-- when the anon role also holds a broad `grant select on <table>` —
-- Postgres treats the table-level grant as covering every column.
--
-- Fix: revoke table-level SELECT from anon + authenticated, then
-- grant SELECT column-by-column with `user_email`, `username_search`,
-- and the promo/step system fields deliberately excluded.
--
-- No app query selects the excluded columns (verified across app/ and
-- lib/), so this is silent for the app. service_role bypasses grants.
-- =====================================================================

revoke select on public.reviews from anon;
revoke select on public.reviews from authenticated;

-- Anon-safe columns for the public reviews API. Explicit list keeps
-- moderation flags (`published`, `guru_review`, `flagged`) visible so
-- the app can filter by them client-side; keeps identity + display
-- fields readable; excludes PII (`user_email`), the search key
-- (`username_search`), and promo-system fields.
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
