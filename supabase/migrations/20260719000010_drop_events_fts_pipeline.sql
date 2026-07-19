-- ─────────────────────────────────────────────────────────────────────
-- Drop the events full-text-search pipeline (TURBOCHECK H-6, S10.13).
--
-- `events.search_document` + `search_vector`, their two GIN indexes,
-- `build_event_search_document()`, and the `t_events_search` trigger
-- recomputed on EVERY event insert/update — and nothing ever read
-- them. Real search is ILIKE over title/host_club/location_formatted
-- (`lib/events/search.ts`); repo-wide grep for the columns, tsquery
-- variants, and `textSearch` has zero app hits. Pure write
-- amplification + index bloat on the hottest table.
--
-- Removed per the dead-code convention; reversible via git if real
-- FTS is ever wired. Trigger → functions → indexes → columns, in
-- dependency order (build_event_search_document takes the `events`
-- row type, so it goes before the columns it names).
-- ─────────────────────────────────────────────────────────────────────

drop trigger if exists t_events_search on events;
drop function if exists trg_event_search();
drop function if exists build_event_search_document(events);
drop index if exists idx_events_search_vector;
drop index if exists idx_events_search_trgm;
alter table events drop column if exists search_vector;
alter table events drop column if exists search_document;
