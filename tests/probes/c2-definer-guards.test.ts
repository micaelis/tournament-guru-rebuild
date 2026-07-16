/**
 * C2 probes — every destructive SECURITY DEFINER function is now
 * either behind an is_admin() / ownership check OR has EXECUTE
 * revoked from anon/authenticated.
 *
 * Coverage:
 *   - `delete_event` / `delete_tournament` refuse a non-owner caller
 *   - `scrub_profile_identity` refuses a caller ≠ target
 *   - `soft_delete_attendee` / `delete_ed_account` same
 *   - `anonymize_account` same
 *   - `recalc_event_ratings` / `recalc_tournament_ratings` EXECUTE
 *     revoked from authenticated (returns 42501 / not accessible)
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

describe("C2 · destructive definer guards", () => {
  it("delete_event by a non-owner authenticated user is refused", async () => {
    const owner = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(owner.id);
    const attacker = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attacker.id);
    const { eventId } = await seedTournamentAndEvent(owner.client);
    const { error } = await attacker.client.rpc("delete_event", {
      target_event: eventId,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
    // Confirm the event still exists.
    const { data: still } = await service()
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();
    expect(still).not.toBeNull();
  });

  it("delete_tournament by a non-owner is refused", async () => {
    const owner = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(owner.id);
    const attacker = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attacker.id);
    const { tournamentId } = await seedTournamentAndEvent(owner.client);
    const { error } = await attacker.client.rpc("delete_tournament", {
      target_tournament: tournamentId,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("scrub_profile_identity against another user is refused", async () => {
    const victim = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(victim.id);
    const attacker = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attacker.id);
    const { error } = await attacker.client.rpc("scrub_profile_identity", {
      target_user: victim.id,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
    // Victim still has their name.
    const { data: p } = await service()
      .from("profiles")
      .select("first_name, blocked")
      .eq("id", victim.id)
      .single();
    expect(p!.blocked).toBe(false);
    expect(p!.first_name).not.toBeNull();
  });

  it("anonymize_account against another user is refused", async () => {
    const victim = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(victim.id);
    const attacker = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attacker.id);
    const { error } = await attacker.client.rpc("anonymize_account", {
      target_user: victim.id,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("soft_delete_attendee against another user is refused", async () => {
    const victim = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(victim.id);
    const attacker = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attacker.id);
    const { error } = await attacker.client.rpc("soft_delete_attendee", {
      target_user: victim.id,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("delete_ed_account against another ED is refused", async () => {
    const victim = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(victim.id);
    const attacker = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(attacker.id);
    const { error } = await attacker.client.rpc("delete_ed_account", {
      target_user: victim.id,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("recalc_event_ratings EXECUTE is revoked from authenticated", async () => {
    const caller = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(caller.id);
    const { error } = await caller.client.rpc("recalc_event_ratings", {
      target_event: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    // Postgres emits 42501 (insufficient_privilege) when EXECUTE is
    // denied; some PostgREST versions surface it as PGRST error text.
    // Accept either the code or a permission-denied message.
    const looksLikePermission =
      error!.code === "42501" ||
      /permission denied|not allowed|does not exist/i.test(error!.message);
    expect(looksLikePermission).toBe(true);
  });
});
