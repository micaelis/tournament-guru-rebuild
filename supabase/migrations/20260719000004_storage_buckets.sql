-- ─────────────────────────────────────────────────────────────────────
-- Supabase Storage buckets + RLS for the upload cutover (supersedes the
-- URL-field deferrals S1.2 and S3.1).
--
-- Defined in SQL so the demo-migrate pipeline (`supabase db push` after
-- green CI, S9.1) provisions them alongside the schema — buckets are
-- rows in storage.buckets, policies are RLS on storage.objects.
--
-- Three buckets, two ownership models:
--   event-images  PUBLIC   event logos, sponsor logos, gallery images
--   org-logos     PUBLIC   organization logos, profile photos
--   promo-csv     PRIVATE  coach-email CSVs (contain emails — never public)
--
-- Path convention: every object is keyed by the UPLOADER's user id as the
-- leading folder — `<auth.uid()>/<filename>`. Two reasons:
--   1. It sidesteps the chicken-and-egg of event-scoped keys: an event
--      logo is uploaded before the event row exists (saveEvent runs after
--      the upload), so the event id isn't available yet. The user id is.
--   2. It gives a dead-simple, robust ownership test —
--      `(storage.foldername(name))[1] = auth.uid()::text` — with no
--      cross-table lookup. A user may write only under their own folder;
--      a non-owner cannot write under someone else's; admin may write
--      anywhere. That is exactly the required guarantee ("owner/admin may
--      write only to their own paths; a non-owner cannot").
--
-- Server-side type + size limits live on the bucket (file_size_limit,
-- allowed_mime_types). These are enforced by the Storage API, not the
-- browser's file-picker `accept`, so a crafted client cannot bypass them.
--
-- NULL-safety: `auth.uid()` is NULL for anon, so the folder predicate is
-- NULL and the row is excluded — correct default-deny for RLS USING/CHECK
-- (unlike a plpgsql `if not (...)` guard, which the NULL would slip
-- through — see S10.3). is_admin() also returns false for anon.
-- ─────────────────────────────────────────────────────────────────────

-- ── Buckets ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-images', 'event-images', true,  10485760, array['image/png','image/jpeg']),
  ('org-logos',    'org-logos',    true,   5242880, array['image/png','image/jpeg']),
  ('promo-csv',    'promo-csv',    false,  2097152, array['text/csv'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Public read on the two public buckets ────────────────────────────
-- (The public CDN endpoint already serves public buckets without auth;
-- this covers the authenticated download/list API path too.)
create policy p_storage_public_read on storage.objects for select
  using (bucket_id in ('event-images', 'org-logos'));

-- ── Owner/admin write on the public image buckets ────────────────────
create policy p_storage_public_write on storage.objects for insert
  with check (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_public_update on storage.objects for update
  using (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_public_delete on storage.objects for delete
  using (
    bucket_id in ('event-images', 'org-logos')
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ── Private promo-csv: owner/admin only, no public read ──────────────
-- Same predicate for SELECT as for writes: reads require ownership or
-- admin, so anon and non-owners cannot download or even list. Signed
-- URLs (created server-side by the owner/admin, who hold SELECT) are the
-- retrieval path.
create policy p_storage_csv_read on storage.objects for select
  using (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_csv_write on storage.objects for insert
  with check (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_csv_update on storage.objects for update
  using (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy p_storage_csv_delete on storage.objects for delete
  using (
    bucket_id = 'promo-csv'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );
