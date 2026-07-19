-- ─────────────────────────────────────────────────────────────────────
-- submitted_csvs UPDATE is admin-only: drop the owner arm.
--
-- 20260719000005 kept a defensive owner arm on p_csv_update ("no ED
-- path updates today, but keep it symmetric with delete"). That arm is
-- itself a hole: `status` is the admin review verdict, and with the arm
-- in place an ED could PATCH their own row to status='approved' via
-- PostgREST, skipping admin review entirely (approved is rendered as
-- "Sent emails" in the ED dashboard, and the admin queue no longer
-- shows the row as pending).
--
-- A column-grant allow-list can't fix this: admin and ED both connect
-- as the `authenticated` Postgres role, so column privileges cannot
-- distinguish them — only RLS can. Status transitions belong to admins
-- (rejectSubmittedCsv, sendPromoEmails→approved); the ED lifecycle is
-- INSERT (submit) and DELETE (cancel while pending), both unchanged.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_csv_update on submitted_csvs;

create policy p_csv_update on submitted_csvs for update
  using (is_admin())
  with check (is_admin());
