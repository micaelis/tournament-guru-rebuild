-- ─────────────────────────────────────────────────────────────────────
-- Gate submitted_csvs writes on being an event host (sibling of S10.1).
--
-- `p_csv_rw` was `ed_id = auth.uid() or is_admin()` for ALL verbs —
-- ownership-only, no role predicate. `ed_id` is caller-supplied and the
-- table grants INSERT to `authenticated`, so an attendee could POST a
-- submitted_csvs row naming themselves as ed_id and dump arbitrary
-- addresses into `raw_emails` — a PII/spam injection straight into the
-- admin review queue. (They could not issue promo codes: p_promo_admin_write
-- is is_admin()-only. But the emails landing in the queue is the harm.)
-- Verified on the local stack: an attendee INSERT succeeded.
--
-- Additionally, the write policy never checked that the CSV's event
-- belongs to the caller — the same parent-authorization gap as S10.2.
-- The submitCsv server action does check it, but RLS is the boundary.
--
-- Split the single `for all` policy into verb-scoped policies:
--   SELECT  ed_id = auth.uid() or is_admin()            (unchanged)
--   INSERT  admin, OR an event host submitting for their OWN event
--   UPDATE  admin (reject/approve), OR host owner (defensive; no ED path
--           updates today, but keep it symmetric with delete)
--   DELETE  admin, OR host owner (the ED "cancel pending" path)
--
-- App write paths, for reference: submitCsv (ED INSERT, own premium
-- event), rejectSubmittedCsv / sendPromoEmails-approve (admin UPDATE),
-- cancelSubmittedCsv (ED DELETE, own pending).
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_csv_rw on submitted_csvs;

create policy p_csv_read on submitted_csvs for select
  using (ed_id = auth.uid() or is_admin());

create policy p_csv_insert on submitted_csvs for insert
  with check (
    is_admin()
    or (
      is_event_host()
      and ed_id = auth.uid()
      and exists (
        select 1 from events e
         where e.id = submitted_csvs.event_id
           and e.owner_id = auth.uid()
      )
    )
  );

create policy p_csv_update on submitted_csvs for update
  using (is_admin() or (is_event_host() and ed_id = auth.uid()))
  with check (is_admin() or (is_event_host() and ed_id = auth.uid()));

create policy p_csv_delete on submitted_csvs for delete
  using (is_admin() or (is_event_host() and ed_id = auth.uid()));
