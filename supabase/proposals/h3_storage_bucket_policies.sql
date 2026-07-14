-- =====================================================================
-- PROPOSAL — H3 · Storage bucket + policy inventory
--
-- Status: DRAFT. Not applied. Requires the bucket names to be verified
-- against the live Supabase project (Storage → Buckets) before this is
-- promoted to a real migration under supabase/migrations/.
--
-- Motivation
-- ----------
-- Nothing in the migrations tree creates or configures any Storage
-- bucket, yet the schema references stored files in seven places:
--
--   profiles.profile_picture     — user avatar
--   profiles.org_logo            — director org logo
--   events.logo                  — event logo
--   events.photos[]              — event gallery photos
--   sponsors.logo                — sponsor logo
--   testimonials.photo           — testimonial portrait
--   submitted_csvs.file_path     — promo-code CSV upload
--
-- Whatever the current state is, it lives in the Supabase Dashboard
-- and isn't tracked. That's a footgun: a fresh project comes up with
-- no buckets, and the app either 404s images or (worse) inherits
-- default policies you didn't audit.
--
-- Proposed inventory
-- ------------------
-- Two public-read buckets and one private:
--
--   public-avatars   — profiles.profile_picture, profiles.org_logo
--     • public read
--     • authenticated owner write / update / delete
--
--   public-events    — events.logo, events.photos[], sponsors.logo,
--                      testimonials.photo
--     • public read
--     • event owner (or admin) write / update / delete, keyed by
--       object path prefix `<event_id>/…`
--     • admin write for testimonials (`testimonials/…` prefix)
--
--   private-csv      — submitted_csvs.file_path
--     • authenticated owner read / write, keyed by prefix `<user_id>/…`
--     • no public read
--
-- Before promoting to a migration
-- -------------------------------
-- 1. Confirm the bucket names above match what the app actually reads
--    from. If different names are already live, either rename in
--    place (irreversible for existing URLs) or adapt the constants
--    below.
-- 2. Confirm the object-path convention: this proposal assumes
--    `<owner_id>/…` for avatars and `<event_id>/…` for event assets.
--    If the current uploads use a flat namespace, the policies below
--    will not match and need widening.
-- 3. Confirm the upload path (server action vs. direct client
--    upload). If the app uploads server-side with the service_role
--    key, none of these WRITE policies matter — service_role bypasses
--    them. But we should still have them for defense-in-depth.
--
-- Rollback: drop the policies + `delete from storage.buckets` (which
-- errors if any object is still stored).
-- =====================================================================

-- ── Buckets ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('public-avatars', 'public-avatars', true),
  ('public-events',  'public-events',  true),
  ('private-csv',    'private-csv',    false)
on conflict (id) do nothing;

-- ── Read policies ───────────────────────────────────────────────────
-- Public buckets have SELECT open to anon.
create policy if not exists "public-avatars: public read"
  on storage.objects for select
  using (bucket_id = 'public-avatars');

create policy if not exists "public-events: public read"
  on storage.objects for select
  using (bucket_id = 'public-events');

-- Private bucket: owner-only reads, keyed by first path segment.
create policy if not exists "private-csv: owner read"
  on storage.objects for select
  using (
    bucket_id = 'private-csv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Write policies ──────────────────────────────────────────────────
-- Avatar/org logo: owner-only writes keyed by first path segment
-- being the user's id.
create policy if not exists "public-avatars: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'public-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy if not exists "public-avatars: owner update"
  on storage.objects for update
  using (
    bucket_id = 'public-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'public-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy if not exists "public-avatars: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'public-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Event assets: writable by the event's owner, keyed by <event_id>
-- prefix. `testimonials/…` prefix is admin-only.
create policy if not exists "public-events: owner or admin write"
  on storage.objects for insert
  with check (
    bucket_id = 'public-events'
    and (
      is_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and e.owner_id = auth.uid()
      )
    )
  );
create policy if not exists "public-events: owner or admin update"
  on storage.objects for update
  using (
    bucket_id = 'public-events'
    and (
      is_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and e.owner_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'public-events'
    and (
      is_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and e.owner_id = auth.uid()
      )
    )
  );
create policy if not exists "public-events: owner or admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'public-events'
    and (
      is_admin()
      or exists (
        select 1 from public.events e
        where e.id::text = (storage.foldername(name))[1]
          and e.owner_id = auth.uid()
      )
    )
  );

-- Private CSV bucket: uploader writes their own subtree only.
create policy if not exists "private-csv: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'private-csv'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
