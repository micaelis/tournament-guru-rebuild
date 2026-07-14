-- =====================================================================
-- C2 — Enable RLS on `cards` and `promo_codes`
--
-- These tables were missing `alter table … enable row level security`
-- entirely. Supabase does not grant `anon/authenticated` any default
-- privileges on the `public` schema, but any future permissive grant
-- (or a misconfigured project) would expose Stripe card metadata and
-- secret promo redemption codes to every logged-in user. Defense-in-
-- depth requires RLS to be on with narrow policies.
--
-- Neither table has any app-side INSERT/UPDATE path today. Both are
-- populated exclusively via server-side flows using the service role
-- (Stripe webhooks for `cards`, CSV import for `promo_codes`). Service
-- role bypasses RLS.
-- =====================================================================

-- ── cards ───────────────────────────────────────────────────────────
alter table public.cards enable row level security;

-- Owner may read their own saved cards. No write policy: mutations
-- happen server-side through the Stripe webhook running as service_role.
create policy "cards: self read"
  on public.cards for select
  using (profile_id = auth.uid() or is_admin());

-- Owner may delete their own saved card (Account → Saved payment methods).
create policy "cards: self delete"
  on public.cards for delete
  using (profile_id = auth.uid());

-- ── promo_codes ─────────────────────────────────────────────────────
alter table public.promo_codes enable row level security;

-- Only the coach whose codes these are (or an admin) can list them.
-- Regular users never see promo_codes; the review-side promo redemption
-- path reads `has_promo_code` on the review itself.
create policy "promo_codes: owner read"
  on public.promo_codes for select
  using (coach_id = auth.uid() or is_admin());

-- Neither authenticated nor anon can INSERT / UPDATE / DELETE from the
-- app. Bulk operations live in server-side flows using service_role.
