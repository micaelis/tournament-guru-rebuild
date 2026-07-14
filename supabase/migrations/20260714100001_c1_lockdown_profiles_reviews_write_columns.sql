-- =====================================================================
-- C1 — Privilege escalation lockdown on profiles + reviews updates
--
-- The old policies allowed any authenticated user to UPDATE *any* column on
-- their own row. That let a user run:
--   update profiles set user_type='admin' where id=auth.uid();
-- and be admin. Same shape on reviews let authors flip published /
-- guru_review / flagged on their own reviews.
--
-- Fix: column-level GRANTs. Column privileges are checked BEFORE RLS by
-- Postgres, so this is a hard cap independent of any USING/WITH CHECK
-- adjustments. The RLS policies stay unchanged (they still scope rows to
-- self) — this migration only narrows *which columns* the authenticated
-- role may write.
--
-- Admin / service-side flows keep working:
--   * service_role bypasses column privileges and RLS.
--   * No app code currently writes the revoked columns from an
--     authenticated session; verified across app/(auth|onboarding),
--     app/dashboard, lib/supabase/queries.ts.
--   * Future admin flows for guru_badge, user_type, etc. should go
--     through a SECURITY DEFINER RPC that checks is_admin() in its body.
--
-- Rollback: `grant update on public.profiles to authenticated;`
--           `grant update on public.reviews  to authenticated;`
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
