-- Track when an event actually went featured/premium, so the homepage Featured
-- strip can order by "most recently featured" rather than by event creation
-- date. Historically we only had `premium boolean` + `created_at/updated_at`,
-- which meant a long-standing event that was just upgraded to premium sorted as
-- if it were old.
--
-- Strategy:
--   * add a nullable `premium_at timestamptz`
--   * backfill existing premium rows from `updated_at` (their last-modified
--     time is the best available proxy for "when it went featured")
--   * stamp it automatically whenever `premium` flips on going forward
--
-- After this migration every premium row has a non-null `premium_at`, so the
-- app can simply order by it (with `updated_at` as a defensive tiebreak).

alter table events add column if not exists premium_at timestamptz;

-- Backfill: empty featured-date → last modified date.
update events
   set premium_at = updated_at
 where premium = true
   and premium_at is null;

-- Stamp premium_at the moment an event becomes premium (on insert-as-premium or
-- a false/null → true transition). A manually-supplied premium_at is preserved,
-- and un-featuring keeps the historical stamp rather than clearing it.
create or replace function stamp_premium_at() returns trigger
  language plpgsql as $$
begin
  if NEW.premium = true
     and (TG_OP = 'INSERT' or OLD.premium is distinct from true) then
    NEW.premium_at = coalesce(NEW.premium_at, now());
  end if;
  return NEW;
end;
$$;

drop trigger if exists t_events_stamp_premium_at on events;
create trigger t_events_stamp_premium_at
  before insert or update of premium on events
  for each row execute function stamp_premium_at();

-- Partial index supporting the featured-strip ordering.
create index if not exists idx_events_premium_at
  on events (premium_at desc)
  where premium = true;
