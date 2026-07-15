-- ─────────────────────────────────────────────────────────────────────
-- Stamp `events.premium_at` on the false → true transition of
-- `is_premium`, and never again. SCHEMA-DESIGN §9 called this trigger
-- out as carry-forward from the audit but the from-scratch baseline
-- omitted it. Without the trigger, `premium_at` stays null even after
-- an upgrade, and the "how long has this been premium" surface breaks.
--
-- - INSERT: if is_premium is true on creation, stamp now().
-- - UPDATE: if is_premium flipped from false → true, stamp now().
--   Any other transition (true → false, or true → true) leaves the
--   existing premium_at alone — coalesce preserves it.
-- ─────────────────────────────────────────────────────────────────────

create or replace function stamp_premium_at()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.is_premium then
    new.premium_at := coalesce(new.premium_at, now());
  elsif tg_op = 'UPDATE' and new.is_premium and not old.is_premium then
    new.premium_at := coalesce(new.premium_at, now());
  end if;
  return new;
end;
$$;

create trigger t_events_stamp_premium
  before insert or update on events
  for each row execute function stamp_premium_at();
