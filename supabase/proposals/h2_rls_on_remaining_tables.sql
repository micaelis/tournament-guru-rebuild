-- =====================================================================
-- PROPOSAL — H2 · Enable RLS on remaining public tables
--
-- Status: DRAFT. Not applied. Review before promoting to a numbered
-- migration under supabase/migrations/.
--
-- Motivation
-- ----------
-- The following tables were created without RLS enabled. Supabase does
-- not grant `anon/authenticated` default privileges on the `public`
-- schema, so today they aren't reachable — but every one of them is a
-- footgun waiting for the first permissive grant. Enabling RLS + a
-- narrow policy set now means we don't rely on grant hygiene forever.
--
-- Tables in scope:
--   • event_ages / event_genders / event_fields / event_features /
--     event_competition_levels / event_age_groups
--       — child tables of `events`. Reads should follow the event's
--         own visibility (non-draft OR owner OR admin). Writes should
--         be limited to the event's owner or an admin.
--   • sponsors
--       — visible under a public event; writable only by the event
--         owner or an admin.
--   • event_profiles
--       — recurring-tournament parents. Marketing surfaces read them.
--         Writes: owner or admin.
--   • testimonials
--       — homepage marketing content. Public read. Admin write.
--   • submitted_csvs
--       — CSV imports for promo codes. Author read only, no anon
--         read. Writes via service_role.
--   • recently_viewed
--       — per-user browsing history. Self read/write only.
--   • profile_age_prefs
--       — per-user preferences. Self read/write only.
--
-- Open questions before promoting to a real migration
-- ---------------------------------------------------
-- 1. Do admins ever need to bulk-edit an event's child tables outside
--    the event owner? (If yes, they'd currently use service_role via
--    a server action — no policy change needed.)
-- 2. `event_age_groups.price` — locking this behind owner-only writes
--    is the correct security posture, but confirm no legacy Bubble
--    import scripts write these as `anon`.
-- 3. Are testimonials ever intended for user-submitted content? If so
--    the write policy needs adjusting.
--
-- Rollback: `alter table … disable row level security;`.
-- =====================================================================

-- ── Helper predicate ────────────────────────────────────────────────
-- Whether the current user owns the event, or is admin.
-- (Duplicated from the base_schema convention rather than a shared
-- function so this file drops in independently.)

-- ── Event child tables: read follows event visibility, write scoped to owner ──

alter table public.event_ages enable row level security;
create policy "event_ages: read via event"
  on public.event_ages for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_ages.event_id
        and (e.status <> 'draft' or e.owner_id = auth.uid() or is_admin())
    )
  );
create policy "event_ages: owner write"
  on public.event_ages for all
  using (
    exists (select 1 from public.events e where e.id = event_ages.event_id and (e.owner_id = auth.uid() or is_admin()))
  )
  with check (
    exists (select 1 from public.events e where e.id = event_ages.event_id and (e.owner_id = auth.uid() or is_admin()))
  );

-- Repeat the same shape for the other event child tables.
alter table public.event_genders enable row level security;
create policy "event_genders: read via event"  on public.event_genders  for select using (exists (select 1 from public.events e where e.id = event_genders.event_id  and (e.status <> 'draft' or e.owner_id = auth.uid() or is_admin())));
create policy "event_genders: owner write"     on public.event_genders  for all    using (exists (select 1 from public.events e where e.id = event_genders.event_id  and (e.owner_id = auth.uid() or is_admin()))) with check (exists (select 1 from public.events e where e.id = event_genders.event_id  and (e.owner_id = auth.uid() or is_admin())));

alter table public.event_fields enable row level security;
create policy "event_fields: read via event"   on public.event_fields   for select using (exists (select 1 from public.events e where e.id = event_fields.event_id   and (e.status <> 'draft' or e.owner_id = auth.uid() or is_admin())));
create policy "event_fields: owner write"      on public.event_fields   for all    using (exists (select 1 from public.events e where e.id = event_fields.event_id   and (e.owner_id = auth.uid() or is_admin()))) with check (exists (select 1 from public.events e where e.id = event_fields.event_id   and (e.owner_id = auth.uid() or is_admin())));

alter table public.event_features enable row level security;
create policy "event_features: read via event" on public.event_features for select using (exists (select 1 from public.events e where e.id = event_features.event_id and (e.status <> 'draft' or e.owner_id = auth.uid() or is_admin())));
create policy "event_features: owner write"    on public.event_features for all    using (exists (select 1 from public.events e where e.id = event_features.event_id and (e.owner_id = auth.uid() or is_admin()))) with check (exists (select 1 from public.events e where e.id = event_features.event_id and (e.owner_id = auth.uid() or is_admin())));

alter table public.event_competition_levels enable row level security;
create policy "event_competition_levels: read via event" on public.event_competition_levels for select using (exists (select 1 from public.events e where e.id = event_competition_levels.event_id and (e.status <> 'draft' or e.owner_id = auth.uid() or is_admin())));
create policy "event_competition_levels: owner write"    on public.event_competition_levels for all    using (exists (select 1 from public.events e where e.id = event_competition_levels.event_id and (e.owner_id = auth.uid() or is_admin()))) with check (exists (select 1 from public.events e where e.id = event_competition_levels.event_id and (e.owner_id = auth.uid() or is_admin())));

alter table public.event_age_groups enable row level security;
create policy "event_age_groups: read via event" on public.event_age_groups for select using (exists (select 1 from public.events e where e.id = event_age_groups.event_id and (e.status <> 'draft' or e.owner_id = auth.uid() or is_admin())));
create policy "event_age_groups: owner write"    on public.event_age_groups for all    using (exists (select 1 from public.events e where e.id = event_age_groups.event_id and (e.owner_id = auth.uid() or is_admin()))) with check (exists (select 1 from public.events e where e.id = event_age_groups.event_id and (e.owner_id = auth.uid() or is_admin())));

-- ── Sponsors: readable under public event, writable by owner ──
alter table public.sponsors enable row level security;
create policy "sponsors: read via event"
  on public.sponsors for select
  using (
    exists (
      select 1 from public.events e
      where e.id = sponsors.event_id
        and (e.status <> 'draft' or e.owner_id = auth.uid() or is_admin())
    )
  );
create policy "sponsors: owner write"
  on public.sponsors for all
  using (exists (select 1 from public.events e where e.id = sponsors.event_id and (e.owner_id = auth.uid() or is_admin())))
  with check (exists (select 1 from public.events e where e.id = sponsors.event_id and (e.owner_id = auth.uid() or is_admin())));

-- ── Event profiles: marketing reads it (public), owner writes ──
alter table public.event_profiles enable row level security;
create policy "event_profiles: public read" on public.event_profiles for select using (true);
create policy "event_profiles: owner write" on public.event_profiles for all
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

-- ── Testimonials: homepage marketing, admin-managed ──
alter table public.testimonials enable row level security;
create policy "testimonials: public read" on public.testimonials for select using (true);
create policy "testimonials: admin write" on public.testimonials for all
  using (is_admin()) with check (is_admin());

-- ── Submitted CSVs: author-visible only, admin sees all ──
alter table public.submitted_csvs enable row level security;
create policy "submitted_csvs: self read"
  on public.submitted_csvs for select
  using (uploader_id = auth.uid() or is_admin());
-- No insert policy from authenticated: uploads happen via service role.

-- ── Recently viewed: fully self-scoped ──
alter table public.recently_viewed enable row level security;
create policy "recently_viewed: self read"  on public.recently_viewed for select using (profile_id = auth.uid());
create policy "recently_viewed: self write" on public.recently_viewed for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ── Profile age prefs: fully self-scoped ──
alter table public.profile_age_prefs enable row level security;
create policy "profile_age_prefs: self read"  on public.profile_age_prefs for select using (profile_id = auth.uid());
create policy "profile_age_prefs: self write" on public.profile_age_prefs for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
