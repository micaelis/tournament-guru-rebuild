-- ─────────────────────────────────────────────────────────────────────
-- M1 (RG1 medium) — increment platform_counters on create.
--
-- `published_reviews_total` already increments via trg_reviews_write
-- on the draft→published transition. The `listed_events_total` and
-- `listed_tournaments_total` counters were seeded at 0 and NEVER
-- moved, so the landing page's stats band read `0 / 0 / N reviews`
-- after events + tournaments landed on the platform.
--
-- Same never-decrement rule as reviews (per SCHEMA-DESIGN §8): only
-- INSERT counts. Delete leaves the counter at its historical high.
-- ─────────────────────────────────────────────────────────────────────

create or replace function trg_bump_tournament_counter()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  update platform_counters
     set value = value + 1
   where key = 'listed_tournaments_total';
  return new;
end;
$$;

create or replace function trg_bump_event_counter()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  update platform_counters
     set value = value + 1
   where key = 'listed_events_total';
  return new;
end;
$$;

create trigger t_tournaments_bump_counter
  after insert on tournaments
  for each row execute function trg_bump_tournament_counter();

create trigger t_events_bump_counter
  after insert on events
  for each row execute function trg_bump_event_counter();

-- Consistent with the rest of the trigger-only helper functions
-- (see migration 20260716000011): revoke client EXECUTE so the only
-- callable path is the trigger runtime.
revoke execute on function trg_bump_tournament_counter() from public, anon, authenticated;
revoke execute on function trg_bump_event_counter()      from public, anon, authenticated;
