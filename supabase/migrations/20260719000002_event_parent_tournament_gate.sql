-- ─────────────────────────────────────────────────────────────────────
-- An event write must also be authorized against its PARENT tournament.
--
-- `p_events_write` validated the event's own `owner_id` but never asked
-- whether the caller may write the tournament the event hangs off. Both
-- halves are caller-supplied, so ED-B could INSERT an event with
-- owner_id = self and tournament_id = <ED-A's tournament> and the policy
-- was satisfied: the row is "yours", so it passed.
--
-- That is not cosmetic. `recalc_tournament_ratings` aggregates every
-- published review reachable via `events e where e.tournament_id =
-- <tournament>`, so an event grafted onto someone else's tournament
-- rolls its reviews into that tournament's `general_rating`,
-- `coach_rating`, `attendee_rating`, and every category average. One ED
-- could attach a poorly-reviewed event to a competitor's tournament and
-- drag their aggregate down; the victim can see the row (public read)
-- but cannot edit or remove it, because they don't own it.
--
-- The rule is simply: you may write an event only if you may write its
-- parent tournament.
--
--   ED-A  -> own tournament          : t.owner_id = auth.uid()  ✓
--   ED-B  -> ED-A's tournament       : denied                   ✓
--   admin -> anywhere                : is_admin()               ✓
--   ED    -> unclaimed admin-created : denied — claim it first, which
--            matches S1.1 and the parked claim-ownership model.
--
-- `tournament_id` is NOT NULL, so the EXISTS can be required
-- unconditionally without stranding parentless rows.
--
-- Ownership transfer still works: approve_claim_request is SECURITY
-- DEFINER and bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists p_events_write on events;
create policy p_events_write on events for all
  using (
    is_event_host()
    and (owner_id = auth.uid() or is_admin())
    and exists (
      select 1 from tournaments t
       where t.id = events.tournament_id
         and (t.owner_id = auth.uid() or is_admin())
    )
  )
  with check (
    is_event_host()
    and (owner_id = auth.uid() or is_admin())
    and exists (
      select 1 from tournaments t
       where t.id = events.tournament_id
         and (t.owner_id = auth.uid() or is_admin())
    )
  );
