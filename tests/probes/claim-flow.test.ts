/**
 * Claim flow probes — the atomic approval RPC transfers ownership
 * across the tournament + all sibling events + auto-declines
 * competing pending claims. A non-admin caller cannot invoke the
 * approve RPC.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

describe("Claim flow", () => {
  it("non-admin caller cannot approve_claim_request", async () => {
    const attendee = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attendee.id);
    const { error } = await attendee.client.rpc("approve_claim_request", {
      target_claim: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("admin approves a claim → ownership transfers across tournament + events + sibling claims auto-decline", async () => {
    const svc = service();
    // Seed an admin-created tournament + events.
    const adminHost = await createUser({
      metadata: {},
      becomeAdmin: true,
      completeOnboarding: true,
      role: "coach", // check-constraint permissive for admin
    });
    users.push(adminHost.id);

    const { data: t } = await svc
      .from("tournaments")
      .insert({
        title: "Unclaimed Cup",
        owner_id: null,
        created_by: adminHost.id,
        claimed: false,
      })
      .select("id")
      .single();
    const { data: ev1 } = await svc
      .from("events")
      .insert({
        tournament_id: t!.id,
        owner_id: null,
        created_by: adminHost.id,
        title: "First",
        lifecycle: "active",
      })
      .select("id")
      .single();
    const { data: ev2 } = await svc
      .from("events")
      .insert({
        tournament_id: t!.id,
        owner_id: null,
        created_by: adminHost.id,
        title: "Second",
        lifecycle: "active",
      })
      .select("id")
      .single();

    const winner = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(winner.id);
    const other = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(other.id);

    // Both submit pending claims.
    const { data: claimWinner } = await winner.client
      .from("claim_requests")
      .insert({
        tournament_id: t!.id,
        event_id: ev1!.id,
        requester_id: winner.id,
        phone: "+1 555 555 5555",
        links: ["https://winner.example"],
      })
      .select("id")
      .single();
    const { data: claimLoser } = await other.client
      .from("claim_requests")
      .insert({
        tournament_id: t!.id,
        event_id: ev2!.id,
        requester_id: other.id,
        phone: "+1 555 000 0000",
        links: ["https://loser.example"],
      })
      .select("id")
      .single();

    // Admin approves the winner.
    const { error } = await adminHost.client.rpc("approve_claim_request", {
      target_claim: claimWinner!.id,
    });
    expect(error).toBeNull();

    // Tournament + both events transferred.
    const { data: tAfter } = await svc
      .from("tournaments")
      .select("owner_id, claimed")
      .eq("id", t!.id)
      .single();
    expect(tAfter!.owner_id).toBe(winner.id);
    expect(tAfter!.claimed).toBe(true);
    const { data: evsAfter } = await svc
      .from("events")
      .select("id, owner_id, claimed")
      .in("id", [ev1!.id, ev2!.id]);
    for (const e of evsAfter ?? []) {
      expect((e as { owner_id: string | null }).owner_id).toBe(winner.id);
      expect((e as { claimed: boolean }).claimed).toBe(true);
    }
    // The loser's claim auto-declined with the canonical reason.
    const { data: loserAfter } = await svc
      .from("claim_requests")
      .select("status, decline_reason")
      .eq("id", claimLoser!.id)
      .single();
    expect(loserAfter!.status).toBe("declined");
    expect(loserAfter!.decline_reason).toContain("Another claim");
  });
});
