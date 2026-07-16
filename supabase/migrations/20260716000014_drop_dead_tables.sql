-- ─────────────────────────────────────────────────────────────────────
-- Turbo-check M-DEAD-3 — drop dead tables.
--
-- `regions` was seeded with I–IV but nothing reads or writes it. The
-- events column `region` is a Postgres enum (event_region), not a FK
-- into `regions`, so the table has no referential purpose either.
-- `EVENT_REGIONS` in lib/enums.ts is the single source of truth for
-- the UI.
--
-- `contact_requests` has a table + RLS policy + rate-limit trigger,
-- but nothing writes to it: the support form uses `support_messages`
-- and no public marketing contact page ships in the rebuild. Dropping
-- the table also lets us drop its rate-limit trigger + its bucket
-- entry from the `rate_limit_touch` allow-list.
--
-- `event_milestones` STAYS. It has a read path (public event page) +
-- no write path today; the empty-state render is a separate turbo-
-- check fix (M-DEAD-2) and wiring the editor is on the backlog.
-- ─────────────────────────────────────────────────────────────────────

drop trigger if exists t_contact_rl on contact_requests;
drop table if exists contact_requests;
drop function if exists trg_contact_requests_rate_limit();

drop table if exists regions;

-- The rate_limit_touch allow-list still names 'contact_requests' for
-- backwards compatibility with any future public contact form; the
-- bucket name is a string, not a table reference, so we leave it as
-- a reserved token. If a caller ever passes it and the trigger is
-- gone, the touch still works — it just never fires from a table
-- insert.
