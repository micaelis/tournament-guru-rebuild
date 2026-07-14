-- =====================================================================
-- H2 — Enable RLS on remaining public tables
--
-- Promoted from supabase/proposals/h2_rls_on_remaining_tables.sql after
-- operator sign-off. All three open questions resolved:
--
--   Q1. Admin bulk-edit of event child tables outside the event owner
--       → SHIP AS `owner OR is_admin()` write everywhere. Consistent
--         with Q1 answer + belt-and-braces for admin flows we haven't
--         written yet. `is_admin()` is a fast helper that returns
--         false for non-admins.
--
--   Q2. `event_age_groups.price` — verified no Bubble import or
--       pg_cron job writes it as `anon` (grep 2026-07-14 across
--       supabase/, .agents/ finds only doc comments; no scheduled
--       cron.schedule anywhere). SHIP AS owner OR is_admin() write.
--
--   Q3. Testimonials are curated admin marketing content only. If UGC
--       testimonials are ever added they go in a separate
--       user_testimonials table with its own moderation pipeline.
--       SHIP AS admin write only.
--
-- Tables in scope:
--   • event_ages / event_genders / event_fields / event_features /
--     event_competition_levels / event_age_groups
--   • sponsors
--   • event_profiles
--   • testimonials
--   • submitted_csvs
--   • recently_viewed
--   • profile_age_prefs
--
-- Rollback: `alter table … disable row level security;` per table.
-- =====================================================================

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
-- No insert/update policy from authenticated: CSV uploads happen
-- server-side via service_role (see docs/CUTOVER-CHECKLIST.md).

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
