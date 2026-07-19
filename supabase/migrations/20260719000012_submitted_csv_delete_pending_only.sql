-- ─────────────────────────────────────────────────────────────────────
-- ED deletes of submitted_csvs only while pending (S10.16).
--
-- "Only pending submissions can be canceled" lived app-side only
-- (cancelSubmittedCsv); the S10.5 DELETE arm let an owning ED delete a
-- row in ANY status straight through PostgREST. Deleting an approved
-- row destroys the admin's review record and the promo_codes audit
-- anchor (promo_codes.submitted_csv_id cascades); deleting a rejected
-- row erases the rejection verdict. The verdict belongs to the admin,
-- so once one exists the row is admin-managed — same principle as the
-- S10.7 admin-only UPDATE.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_csv_delete on submitted_csvs;

create policy p_csv_delete on submitted_csvs for delete
  using (
    is_admin()
    or (is_event_host() and ed_id = auth.uid() and status = 'pending')
  );
