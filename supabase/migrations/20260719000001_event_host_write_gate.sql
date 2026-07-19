-- ─────────────────────────────────────────────────────────────────────
-- Gate tournament/event writes on the caller actually being an event
-- host (event_director or admin).
--
-- `p_tournaments_write` / `p_events_write` only ever asked "is this row
-- yours?" (`owner_id = auth.uid() or is_admin()`) — never "are you a
-- role that may host events at all". An attendee satisfies
-- `owner_id = auth.uid()` simply by writing their own id into the
-- payload, and both tables grant INSERT/UPDATE on `owner_id`,
-- `claimed`, and `lifecycle` to `authenticated`. So any attendee could,
-- straight through PostgREST:
--
--   1. INSERT a tournament with owner_id = self          → allowed
--   2. INSERT an event under it with lifecycle='active'  → allowed
--   3. anon then reads it (p_events_read: lifecycle <> 'draft')
--
-- i.e. inject arbitrary published listings into public discovery. The
-- only thing standing in the way was the `user_type === 'attendee'`
-- check inside the createTournament server action, which is an
-- affordance and not a boundary — the same shape as C-1, where write
-- grants on the public_* views were the sole control.
--
-- The tier columns (`is_premium`, `is_general_ad`) are already withheld
-- from the column grants, so this was never a route to Featured /
-- Spotlight placement — but ordinary public listings were reachable.
--
-- `is_admin()` implies `is_event_host()`, so the admin branch is
-- unchanged: admins keep writing rows they don't own (owner_id null =
-- unclaimed, per S1.1). EDs still manage only their own.
--
-- The event child tables (event_age_groups, sponsors, …) delegate to the
-- parent event's owner check, so they are transitively covered: an
-- attendee can no longer own an event to hang children off.
-- ─────────────────────────────────────────────────────────────────────

-- Mirrors is_admin(): STABLE + SECURITY DEFINER so the policy can read
-- profiles without the caller needing select on the row.
create or replace function is_event_host()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists(
    select 1 from profiles
     where id = auth.uid()
       and user_type in ('event_director', 'admin')
  );
$$;

revoke execute on function is_event_host() from public;
grant execute on function is_event_host() to anon, authenticated;

drop policy if exists p_tournaments_write on tournaments;
create policy p_tournaments_write on tournaments for all
  using      (is_event_host() and (owner_id = auth.uid() or is_admin()))
  with check (is_event_host() and (owner_id = auth.uid() or is_admin()));

drop policy if exists p_events_write on events;
create policy p_events_write on events for all
  using      (is_event_host() and (owner_id = auth.uid() or is_admin()))
  with check (is_event_host() and (owner_id = auth.uid() or is_admin()));
