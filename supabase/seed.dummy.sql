-- =====================================================================
-- Tournament Guru — dummy seed (PLACEHOLDER).
--
-- This file is a PLACEHOLDER. The real seed is auto-generated from the
-- live database by scripts/generate-seed-dummy.sh, which:
--
--   • Copies every table whose contents should be preserved
--     (profiles, events, reviews, user_teams, event_* joins, sponsors,
--     testimonials, event_profiles) into a temporary staging schema.
--   • Scrubs every email column to user_<uuid8>@example.test
--     (deterministic — the same input DB always yields the same seed).
--   • NULLs profiles.stripe_id.
--   • Empties cards, promo_codes, contact_requests, submitted_csvs,
--     transactions (structure-only).
--   • Dumps with pg_dump --data-only --column-inserts.
--   • Appends the two verification queries below (which MUST return
--     zero rows for the seed to be safe to commit).
--
-- To regenerate:
--
--     DATABASE_URL='postgres://…' bash scripts/generate-seed-dummy.sh
--
-- After regenerating, replace this file with the script's output. The
-- verification queries at the tail check that no real address survived
-- the scrub; do not commit a seed where they return rows.
-- =====================================================================

-- ── Verification ─────────────────────────────────────────────────────
-- (Included here so the shape of the check is versioned, even before
-- the real dump has been generated.)
select 'profiles leaked email' as failure, id, contact_email
  from public.profiles
 where contact_email is not null
   and contact_email !~ '@example\.test$';

select 'reviews leaked email' as failure, id, user_email
  from public.reviews
 where user_email is not null
   and user_email !~ '@example\.test$';
