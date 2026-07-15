-- ─────────────────────────────────────────────────────────────────────
-- Atomic claim-request RPCs.
--
-- approve_claim_request(target_claim):
--   - Sets the claim to approved
--   - Transfers ownership of the tournament + all its events to the
--     requester (spec: ownership + all sibling events + linked
--     tournament move together)
--   - Auto-declines every other pending claim on the same tournament
--     with a canonical decline reason (spec: "all the other pending
--     requests on this event should be automatically marked as
--     rejected")
--   All in one transaction so a partial write can't happen.
--
-- decline_claim_request(target_claim, reason):
--   - Sets the claim to declined with the admin's reason
--   - Leaves ownership state alone
--
-- Both are SECURITY DEFINER so they can flip the columns the client
-- grant otherwise blocks (owner_id + claimed on events / tournaments).
-- Callers must be admins — the RPC checks is_admin() at entry.
-- ─────────────────────────────────────────────────────────────────────

create or replace function approve_claim_request(target_claim uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_tournament uuid;
  v_requester  uuid;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select tournament_id, requester_id into v_tournament, v_requester
    from claim_requests where id = target_claim;
  if v_tournament is null then
    raise exception 'claim request % not found', target_claim
      using errcode = '02000';
  end if;

  -- 1. Mark this claim approved.
  update claim_requests
     set status = 'approved', decline_reason = null
   where id = target_claim;

  -- 2. Transfer the tournament to the requester.
  update tournaments
     set owner_id = v_requester,
         claimed = true
   where id = v_tournament;

  -- 3. Transfer every event under the tournament.
  update events
     set owner_id = v_requester,
         claimed = true
   where tournament_id = v_tournament;

  -- 4. Auto-decline every other pending claim on the same tournament.
  update claim_requests
     set status = 'declined',
         decline_reason = 'Another claim on this tournament was approved.'
   where tournament_id = v_tournament
     and id <> target_claim
     and status = 'pending';
end;
$$;

create or replace function decline_claim_request(
  target_claim uuid,
  reason text
) returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if reason is null or length(btrim(reason)) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;
  update claim_requests
     set status = 'declined',
         decline_reason = btrim(reason)
   where id = target_claim
     and status = 'pending';
end;
$$;
