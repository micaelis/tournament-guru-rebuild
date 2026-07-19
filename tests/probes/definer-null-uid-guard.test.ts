/**
 * SECURITY DEFINER guards must reject a NULL `auth.uid()` (anon).
 *
 * The guards were written `if not (is_admin() or <owner> = auth.uid())`.
 * For anon, `auth.uid()` is NULL, so `<owner> = auth.uid()` is NULL —
 * not false. `false or NULL` → NULL, `not NULL` → NULL, and `if NULL`
 * does not execute, so the guard fell through and the function ran with
 * definer privileges (BYPASSRLS). An anon client holding only the public
 * anon key could destroy any claimed tournament and its events, delete
 * events, and anonymize / scrub / delete arbitrary accounts.
 *
 * `c2-definer-guards` covers the AUTHENTICATED non-owner, whose
 * `auth.uid()` is a real uuid — the comparison is false, so the guard
 * fires correctly there. Only the NULL/anon case slipped through, which
 * is why that probe stayed green while this hole was open.
 *
 * Migration 20260719000003 fixes both layers: an explicit
 * `auth.uid() is null` check plus an `is not true` predicate, and
 * EXECUTE revoked from anon. Each test asserts the CALL is refused AND
 * that the target data is still intact — a revoke alone would satisfy
 * the first half, so the survival assertion is what pins the guard.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createUser, purge, service } from "../harness";

const users: string[] = [];
const tournaments: string[] = [];

let ed: { id: string };
let victim: { id: string };

beforeAll(async () => {
  const e = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  users.push(e.id);
  ed = e;

  const v = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
    firstName: "Victim",
  });
  users.push(v.id);
  victim = v;
});

afterAll(async () => {
  const svc = service();
  for (const id of tournaments) {
    await svc.from("events").delete().eq("tournament_id", id);
    await svc.from("tournaments").delete().eq("id", id);
  }
  await purge(users);
});

async function seedClaimedTournamentWithEvent(): Promise<{
  tournamentId: string;
  eventId: string;
}> {
  const svc = service();
  const { data: t } = await svc
    .from("tournaments")
    .insert({
      title: "Definer Guard Cup",
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
    })
    .select("id")
    .single<{ id: string }>();
  tournaments.push(t!.id);
  const { data: e } = await svc
    .from("events")
    .insert({
      tournament_id: t!.id,
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
      title: "Definer Guard Event",
      lifecycle: "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    })
    .select("id")
    .single<{ id: string }>();
  return { tournamentId: t!.id, eventId: e!.id };
}

describe("definer guards · anon (NULL auth.uid) is refused", () => {
  it("delete_tournament: anon cannot destroy a CLAIMED tournament or its events", async () => {
    const { tournamentId, eventId } = await seedClaimedTournamentWithEvent();

    const { error } = await anon().rpc("delete_tournament", {
      target_tournament: tournamentId,
    });
    expect(error).not.toBeNull();

    const svc = service();
    const { data: t } = await svc
      .from("tournaments")
      .select("id")
      .eq("id", tournamentId);
    const { data: e } = await svc.from("events").select("id").eq("id", eventId);
    expect(t ?? []).toHaveLength(1);
    expect(e ?? []).toHaveLength(1);
  });

  it("delete_event: anon cannot delete an event", async () => {
    const { eventId } = await seedClaimedTournamentWithEvent();

    const { error } = await anon().rpc("delete_event", {
      target_event: eventId,
    });
    expect(error).not.toBeNull();

    const { data } = await service().from("events").select("id").eq("id", eventId);
    expect(data ?? []).toHaveLength(1);
  });

  it("anonymize_account: anon cannot strip authorship from someone's reviews", async () => {
    const svc = service();
    const { eventId } = await seedClaimedTournamentWithEvent();
    const { data: review } = await svc
      .from("reviews")
      .insert({
        event_id: eventId,
        author_id: victim.id,
        status: "published",
        review_title: "Mine",
        review_body: "This review belongs to its author.",
        rating_fields: 4,
        rating_facilities: 4,
        rating_management: 4,
        rating_competition: 4,
        rating_diversity: 4,
        rating_cost_value: 4,
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    const { error } = await anon().rpc("anonymize_account", {
      target_user: victim.id,
    });
    expect(error).not.toBeNull();

    const { data: after } = await svc
      .from("reviews")
      .select("author_id, anonymized")
      .eq("id", review!.id)
      .single<{ author_id: string | null; anonymized: boolean }>();
    expect(after!.author_id).toBe(victim.id);
    expect(after!.anonymized).toBe(false);

    await svc.from("reviews").delete().eq("id", review!.id);
  });

  it("scrub_profile_identity: anon cannot wipe a profile or block the user", async () => {
    const { error } = await anon().rpc("scrub_profile_identity", {
      target_user: victim.id,
    });
    expect(error).not.toBeNull();

    const { data } = await service()
      .from("profiles")
      .select("first_name, blocked")
      .eq("id", victim.id)
      .single<{ first_name: string | null; blocked: boolean }>();
    expect(data!.first_name).toBe("Victim");
    expect(data!.blocked).toBe(false);
  });

  it("soft_delete_attendee: anon cannot soft-delete an account", async () => {
    const { error } = await anon().rpc("soft_delete_attendee", {
      target_user: victim.id,
    });
    expect(error).not.toBeNull();

    const { data } = await service()
      .from("profiles")
      .select("first_name, blocked")
      .eq("id", victim.id)
      .single<{ first_name: string | null; blocked: boolean }>();
    expect(data!.first_name).toBe("Victim");
    expect(data!.blocked).toBe(false);
  });

  it("delete_ed_account: anon cannot delete an ED's account or their tournaments", async () => {
    const { tournamentId } = await seedClaimedTournamentWithEvent();

    const { error } = await anon().rpc("delete_ed_account", {
      target_user: ed.id,
    });
    expect(error).not.toBeNull();

    const svc = service();
    const { data: t } = await svc
      .from("tournaments")
      .select("id")
      .eq("id", tournamentId);
    expect(t ?? []).toHaveLength(1);
    const { data: p } = await svc
      .from("profiles")
      .select("blocked")
      .eq("id", ed.id)
      .single<{ blocked: boolean }>();
    expect(p!.blocked).toBe(false);
  });

  it("the owner can still delete their own tournament (the guard is not a blanket deny)", async () => {
    const owner = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(owner.id);
    const svc = service();
    const { data: t } = await svc
      .from("tournaments")
      .insert({
        title: "Owner Deletable Cup",
        owner_id: owner.id,
        created_by: owner.id,
        claimed: true,
      })
      .select("id")
      .single<{ id: string }>();

    const { error } = await owner.client.rpc("delete_tournament", {
      target_tournament: t!.id,
    });
    expect(error).toBeNull();

    const { data } = await svc.from("tournaments").select("id").eq("id", t!.id);
    expect(data ?? []).toHaveLength(0);
  });
});
