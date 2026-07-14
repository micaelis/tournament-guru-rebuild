-- =====================================================================
-- C1 — Privilege escalation lockdown on profiles + reviews writes
--
-- The old policies allowed any authenticated user to UPDATE *any*
-- column on their own row and INSERT reviews with any moderation
-- flags set. That let a user run:
--
--   update profiles set user_type='admin' where id=auth.uid();
--   -- and now is_admin() returns true.
--
--   insert into reviews (author_id, event_id, published, guru_review, ...)
--   values (auth.uid(), '<any event>', true, true, ...);
--   -- self-published review with the Guru badge, unmoderated.
--
-- Fix: column-level GRANTs on both UPDATE and INSERT. Column privileges
-- are checked BEFORE RLS by Postgres, so this is a hard cap independent
-- of any USING/WITH CHECK adjustments. The RLS policies still scope
-- rows to self — this migration narrows *which columns* the
-- authenticated role may write on both operations.
--
-- Admin / service-side flows keep working:
--   * service_role bypasses column privileges and RLS.
--   * No app code currently writes the revoked columns from an
--     authenticated session; verified across app/(auth|onboarding),
--     app/dashboard, lib/supabase/queries.ts.
--   * Future admin flows for guru_badge, user_type, published,
--     guru_review, etc. should go through a SECURITY DEFINER RPC that
--     checks is_admin() in its body.
--
-- Rollback: `grant update, insert on public.profiles, public.reviews
--            to authenticated;`
-- =====================================================================

-- ── profiles ────────────────────────────────────────────────────────
-- Wipe any existing column grants so we're not layering on top of a
-- broad `grant update on profiles to authenticated`.
revoke update on public.profiles from authenticated;

-- Narrow allow-list. Every column in this set is either set by the user
-- via onboarding (see app/(onboarding)/actions.ts:126-146) or via the
-- dashboard account editor (app/dashboard/account/actions.ts:38-58).
-- Notably absent: user_type, status, title, guru_badge, org_logo,
-- stripe_id, existed_before, promo_invited, total_events,
-- total_premium_events, total_reviews, location, pref_location,
-- pref_location_text, created_at.
grant update (
  first_name,
  last_name,
  full_name,
  contact_email,
  attendee_type,
  club_affiliation,
  org_description,
  location_text,
  gender,
  dob,
  pref_distance,
  pref_competition,
  onboarding_complete,
  onboarding_step,
  email_fav_events,
  inapp_fav_events,
  email_review_likes,
  inapp_review_likes,
  email_event_reviews,
  inapp_event_reviews,
  email_review_comments,
  inapp_review_comments,
  email_comment_replies,
  inapp_comment_replies,
  updated_at
) on public.profiles to authenticated;

-- ── reviews ─────────────────────────────────────────────────────────
-- Same idea. Revoked columns: published (moderation gate), guru_review
-- (admin badge), flagged (moderation), has_promo_code / promo_code
-- (system), step (Bubble workflow bookkeeping), event_id / author_id /
-- event_owner_id / username_search / user_email (identity + PII —
-- covered in C3).
revoke update on public.reviews from authenticated;

grant update (
  review_title,
  review_body,
  team1,
  team2,
  team3,
  team_age,
  team_gender,
  overall_rating,
  facilities_rating,
  fields_rating,
  management_rating,
  cost_value_rating,
  competition_rating,
  diversity_rating,
  username,
  user_club,
  user_role
) on public.reviews to authenticated;

-- ── belt-and-braces: policy WITH CHECK on profiles ──────────────────
-- Even if a future migration widens the column grants above, the
-- policy prevents a user from writing certain values into user_type.
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id or is_admin())
  with check (
    -- Admin bypass so an admin can promote users through service_role
    -- OR via a future admin RPC that flips role to postgres.
    is_admin()
    or (
      auth.uid() = id
      -- A regular user cannot land as admin or event_director via a
      -- self update. Onboarding writes attendee_type (coach / parent /
      -- team_manager) which is a separate column.
      and user_type in ('attendee', 'company')
    )
  );

-- ── belt-and-braces: policy WITH CHECK on reviews ───────────────────
drop policy if exists "reviews: author update" on public.reviews;
create policy "reviews: author update"
  on public.reviews for update
  using (author_id = auth.uid() or is_admin())
  with check (
    is_admin()
    or (
      author_id = auth.uid()
      -- Author cannot self-publish (moderation gate), self-award the
      -- Guru badge, or clear a flag placed by moderators.
      and published = (select r.published from public.reviews r where r.id = reviews.id)
      and guru_review = (select r.guru_review from public.reviews r where r.id = reviews.id)
      and flagged = (select r.flagged from public.reviews r where r.id = reviews.id)
    )
  );

-- ── reviews INSERT lockdown ─────────────────────────────────────────
-- Supabase's default Data API grants often include INSERT on public
-- tables to `authenticated`; without this revoke a user could POST to
-- /rest/v1/reviews with published=true, guru_review=true. Column-level
-- INSERT grants keep moderation fields at their table defaults, and
-- the policy WITH CHECK enforces the same invariant.
revoke insert on public.reviews from authenticated;
revoke insert on public.reviews from public;

-- Author-safe insertable columns. Explicitly OMIT:
--   • `id` (default),
--   • `event_owner_id` (denormalized from events.owner_id — set by a
--     trigger or the moderator; excluded from authenticated insert),
--   • `published`, `guru_review`, `flagged` — moderation only,
--   • `has_promo_code`, `promo_code`, `step` — system,
--   • `username_search`, `user_email` — PII / derived (see C3),
--   • `created_at`, `updated_at` — timestamps.
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

drop policy if exists "reviews: author insert" on public.reviews;
create policy "reviews: author insert"
  on public.reviews for insert
  with check (
    author_id = auth.uid()
    -- Moderation fields must land at their table-default values on
    -- creation. `published` starts false (moderator publishes later),
    -- `guru_review` is admin-only, `flagged` starts false.
    and (published is null or published = false)
    and (guru_review is null or guru_review = false)
    and (flagged is null or flagged = false)
  );

comment on policy "reviews: author insert" on public.reviews is
  'Author may insert reviews as themselves. Moderation fields (published/guru_review/flagged) are pinned to their defaults; column-level INSERT grants also exclude those columns as belt-and-braces.';
