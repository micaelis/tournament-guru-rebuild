/**
 * Event tier escalation probes — verify that only admins can flip
 * is_premium and is_general_ad. Column grants + SECURITY DEFINER
 * RPCs enforce this at the database boundary.
 *
 * Coverage:
 *   - ED (event owner) cannot UPDATE is_premium directly
 *   - ED (event owner) cannot UPDATE is_general_ad directly
 *   - ED cannot call admin_set_premium RPC
 *   - ED cannot call admin_set_general_ad RPC
 *   - Admin CAN set both via the RPCs
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

describe("Event tier escalation", () => {
  it("ED cannot self-upgrade is_premium via direct UPDATE", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
    const { error } = await ed.client
      .from("events")
      .update({ is_premium: true } as never)
      .eq("id", eventId);
    expect(error).not.toBeNull();
    const { data } = await service()
      .from("events")
      .select("is_premium")
      .eq("id", eventId)
      .single();
    expect(data!.is_premium).toBe(false);
  });

  it("ED cannot self-upgrade is_general_ad via direct UPDATE", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
    const { error } = await ed.client
      .from("events")
      .update({ is_general_ad: true } as never)
      .eq("id", eventId);
    expect(error).not.toBeNull();
    const { data } = await service()
      .from("events")
      .select("is_general_ad")
      .eq("id", eventId)
      .single();
    expect(data!.is_general_ad).toBe(false);
  });

  it("ED cannot call admin_set_premium RPC", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
    const { error } = await ed.client.rpc("admin_set_premium", {
      target_event: eventId,
      val: true,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
    const { data } = await service()
      .from("events")
      .select("is_premium")
      .eq("id", eventId)
      .single();
    expect(data!.is_premium).toBe(false);
  });

  it("ED cannot call admin_set_general_ad RPC", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
    const { error } = await ed.client.rpc("admin_set_general_ad", {
      target_event: eventId,
      val: true,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
    const { data } = await service()
      .from("events")
      .select("is_general_ad")
      .eq("id", eventId)
      .single();
    expect(data!.is_general_ad).toBe(false);
  });

  it("admin CAN set is_premium and is_general_ad via RPCs", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const admin = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
      becomeAdmin: true,
    });
    users.push(admin.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);

    const { error: e1 } = await admin.client.rpc("admin_set_premium", {
      target_event: eventId,
      val: true,
    });
    expect(e1).toBeNull();

    const { error: e2 } = await admin.client.rpc("admin_set_general_ad", {
      target_event: eventId,
      val: true,
    });
    expect(e2).toBeNull();

    const { data } = await service()
      .from("events")
      .select("is_premium, is_general_ad")
      .eq("id", eventId)
      .single();
    expect(data!.is_premium).toBe(true);
    expect(data!.is_general_ad).toBe(true);
  });
});
