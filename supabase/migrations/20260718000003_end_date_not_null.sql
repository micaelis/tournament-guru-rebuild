-- ─────────────────────────────────────────────────────────────────────
-- Make end_date NOT NULL. The Spotlight filter and derived event status
-- depend on end_date; null values break both. Backfill existing nulls:
-- if start_date is set, end_date = start_date (single-day event);
-- otherwise both get current_date.
-- ─────────────────────────────────────────────────────────────────────

update events
   set end_date = coalesce(start_date, current_date)
 where end_date is null;

update events
   set start_date = end_date
 where start_date is null;

alter table events
  alter column end_date set not null,
  alter column start_date set not null;
