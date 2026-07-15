-- ─────────────────────────────────────────────────────────────────────
-- submitted_csvs.raw_emails — the parsed list of coach emails from the
-- ED's uploaded CSV, stored inline as a JSONB array so admin review
-- can render the row list without going back to the bucket.
--
-- Trade-off: reduces the CSV to its email column. The Reviews spec
-- ("Limit of 1000 rows per file") caps this at ~1000 short strings, a
-- few tens of KB max — well within JSONB's happy path.
--
-- The `file_path` column stays on the table because a follow-up will
-- wire the private bucket upload flow (see DECISIONS §S3.1). Until
-- then, an in-memory synthetic string is fine for the primary flow.
-- ─────────────────────────────────────────────────────────────────────

alter table submitted_csvs
  add column if not exists raw_emails jsonb not null default '[]'::jsonb;

alter table submitted_csvs
  alter column file_path drop not null;
