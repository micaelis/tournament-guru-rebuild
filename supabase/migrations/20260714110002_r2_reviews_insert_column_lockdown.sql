-- =====================================================================
-- R2 — Lock down reviews INSERT the same way UPDATE was locked in C1
--
-- Hostile-review finding: C1 (`20260714100001`) revoked/re-granted
-- UPDATE on `reviews` column-by-column so authors can't flip
-- `published`, `guru_review`, or `flagged` on their own reviews. But
-- the INSERT side was untouched — `reviews: author insert` policy only
-- checks `author_id = auth.uid()`, and Supabase's Data API grants
-- INSERT-on-all-tables to `authenticated` by default. An attacker with
-- an authenticated JWT could:
--
--   insert into reviews (author_id, event_id, review_title, review_body,
--                        published, guru_review, flagged, overall_rating)
--   values (auth.uid(), '<any event id>', 'Fake', '...', true, true, false, 5);
--
-- Result: self-published review with the "Guru" badge, no moderation.
--
-- Fix — same shape as C1:
--   1. Revoke INSERT on reviews from authenticated / PUBLIC.
--   2. Re-grant INSERT column-by-column, excluding the moderation
--      fields (published, guru_review, flagged) and system fields
--      (has_promo_code, promo_code, step, username_search, user_email,
--      event_owner_id — the trigger sets that from the event).
--   3. Belt-and-braces: the insert policy now WITH CHECKs the
--      moderation defaults so even a widened grant can't create a
--      published/guru-branded row.
--
-- Service role bypasses both grants and RLS, so admin flows keep
-- working (that's how a moderator publishes/flags on server actions).
-- =====================================================================

revoke insert on public.reviews from authenticated;
revoke insert on public.reviews from public;

-- Author-safe insertable columns. Explicitly OMIT: `id` (default),
-- `event_owner_id` (denormalized from events.owner_id — set by a
-- trigger if any, or by the caller from lookup; safer to exclude from
-- authenticated insert and let it default null / be set server-side),
-- `published`, `guru_review`, `flagged`, `has_promo_code`, `promo_code`,
-- `step`, `username_search`, `user_email`, `created_at`, `updated_at`.
grant insert (
  event_id,
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
  diversity_rating
) on public.reviews to authenticated;

-- Tighten the insert policy: even if a future migration widens the
-- column grants, moderation fields must land at their defaults.
drop policy if exists "reviews: author insert" on public.reviews;
create policy "reviews: author insert"
  on public.reviews for insert
  with check (
    author_id = auth.uid()
    -- Moderation fields must be at their table-default values on
    -- creation. `published` starts false (moderator publishes later);
    -- `guru_review` is set by admin promotion; `flagged` starts false.
    and (published is null or published = false)
    and (guru_review is null or guru_review = false)
    and (flagged is null or flagged = false)
  );

comment on policy "reviews: author insert" on public.reviews is
  'Author may insert reviews as themselves. Moderation fields (published/guru_review/flagged) are pinned to their defaults; column-level INSERT grants also exclude those columns as belt-and-braces.';
