/**
 * Event writes are authorized against the PARENT tournament, not just
 * the event row's own owner_id.
 *
 * `p_events_write` used to check only `owner_id = auth.uid()`. Both that
 * and `tournament_id` are caller-supplied, so ED-B could INSERT an event
 * owned by ED-B whose `tournament_id` pointed at ED-A's tournament — the
 * row was "theirs", so the policy passed.
 *
 * The damage is in the rollup: `recalc_tournament_ratings` averages every
 * published review reachable through `events.tournament_id`, so a grafted
 * event drags the victim tournament's aggregate ratings with it, and the
 * victim can see the row but not remove it (they don't own it).
 *
 * Migration 20260719000002 requires that the caller may also write the
 * parent tournament.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, service } from "../harness";

const users: string[] = [];
const tournaments: string[] = [];

afterAll(async () => {
  const svc = service();
  for (const id of tournaments) {
    await svc.from("events").delete().eq("tournament_id", id);
    await svc.from("tournaments").delete().eq("id", id);
  }
  await purge(users);
});

async function director() {
  const u = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  users.push(u.id);
  return u;
}

async function seedTournament(
  ownerId: string | null,
  createdBy: string,
  title: string,
): Promise<string> {
  const { data } = await service()
    .from("tournaments")
    .insert({
      title,
      owner_id: ownerId,
      created_by: createdBy,
      claimed: ownerId !== null,
    })
    .select("id")
    .single<{ id: string }>();
  tournaments.push(data!.id);
  return data!.id;
}

describe("event parent-tournament gate · an ED cannot graft events onto another ED's tournament", () => {
  it("ED-B cannot INSERT an event under ED-A's tournament", async () => {
    const edA = await director();
    const edB = await director();
    const tId = await seedTournament(edA.id, edA.id, "ED-A Cup");

    const { error } = await edB.client.from("events").insert({
      tournament_id: tId,
      owner_id: edB.id,
      created_by: edB.id,
      claimed: true,
      title: "ED-B Graft",
      lifecycle: "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    });

    expect(error).not.toBeNull();
    const { data: rows } = await service()
      .from("events")
      .select("id")
      .eq("tournament_id", tId);
    expect(rows ?? []).toHaveLength(0);
  });

  it("ED-B cannot REPARENT their own event onto ED-A's tournament", async () => {
    const edA = await director();
    const edB = await director();
    const tA = await seedTournament(edA.id, edA.id, "ED-A Cup 2");
    const tB = await seedTournament(edB.id, edB.id, "ED-B Cup");

    const { data: own } = await service()
      .from("events")
      .insert({
        tournament_id: tB,
        owner_id: edB.id,
        created_by: edB.id,
        claimed: true,
        title: "ED-B Own Event",
        lifecycle: "active",
        start_date: "2030-06-01",
        end_date: "2030-06-03",
      })
      .select("id")
      .single<{ id: string }>();

    await edB.client
      .from("events")
      .update({ tournament_id: tA })
      .eq("id", own!.id);

    const { data: after } = await service()
      .from("events")
      .select("tournament_id")
      .eq("id", own!.id)
      .single<{ tournament_id: string }>();
    expect(after!.tournament_id).toBe(tB);
  });

  it("a grafted event cannot pollute another ED's tournament rating", async () => {
    const edA = await director();
    const edB = await director();
    const svc = service();
    const tId = await seedTournament(edA.id, edA.id, "Rating Integrity Cup");

    // ED-A's own event, reviewed well.
    const { data: good } = await svc
      .from("events")
      .insert({
        tournament_id: tId,
        owner_id: edA.id,
        created_by: edA.id,
        claimed: true,
        title: "Well Run Event",
        lifecycle: "active",
        start_date: "2030-06-01",
        end_date: "2030-06-03",
      })
      .select("id")
      .single<{ id: string }>();

    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);
    await svc.from("reviews").insert({
      event_id: good!.id,
      author_id: coach.id,
      status: "published",
      review_title: "Great",
      review_body: "Great event.",
      rating_fields: 5,
      rating_facilities: 5,
      rating_management: 5,
      rating_competition: 5,
      rating_diversity: 5,
      rating_cost_value: 5,
      reviewer_user_type: "attendee",
      reviewer_role: "coach",
      published_at: new Date().toISOString(),
    });

    const { data: before } = await svc
      .from("tournaments")
      .select("general_rating")
      .eq("id", tId)
      .single<{ general_rating: number | null }>();

    // ED-B tries to graft a 1-star event onto ED-A's tournament.
    const { error } = await edB.client.from("events").insert({
      tournament_id: tId,
      owner_id: edB.id,
      created_by: edB.id,
      claimed: true,
      title: "Sabotage Event",
      lifecycle: "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    });
    expect(error).not.toBeNull();

    const { data: after } = await svc
      .from("tournaments")
      .select("general_rating")
      .eq("id", tId)
      .single<{ general_rating: number | null }>();
    expect(after!.general_rating).toBe(before!.general_rating);
  });

  it("an ED can still add an event to their OWN tournament", async () => {
    const ed = await director();
    const tId = await seedTournament(ed.id, ed.id, "Own Cup");

    const { error } = await ed.client.from("events").insert({
      tournament_id: tId,
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
      title: "Legit Event",
      lifecycle: "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    });
    expect(error).toBeNull();
  });

  it("an admin can still add an event to an unclaimed tournament", async () => {
    const admin = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      becomeAdmin: true,
      completeOnboarding: true,
      role: "coach",
    });
    users.push(admin.id);
    const tId = await seedTournament(null, admin.id, "Admin Unclaimed Cup");

    const { error } = await admin.client.from("events").insert({
      tournament_id: tId,
      owner_id: null,
      created_by: admin.id,
      claimed: false,
      title: "Admin Event",
      lifecycle: "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    });
    expect(error).toBeNull();
  });

  it("an admin can still edit an event on a claimed ED tournament", async () => {
    const ed = await director();
    const admin = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      becomeAdmin: true,
      completeOnboarding: true,
      role: "coach",
    });
    users.push(admin.id);
    const tId = await seedTournament(ed.id, ed.id, "Claimed Cup");

    const { data: e } = await service()
      .from("events")
      .insert({
        tournament_id: tId,
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
        title: "ED Event",
        lifecycle: "active",
        start_date: "2030-06-01",
        end_date: "2030-06-03",
      })
      .select("id")
      .single<{ id: string }>();

    // Spec addendum (S1.1): editing an EVENT is always allowed for admins.
    const { error } = await admin.client
      .from("events")
      .update({ title: "Admin Edited" })
      .eq("id", e!.id);
    expect(error).toBeNull();

    const { data: after } = await service()
      .from("events")
      .select("title")
      .eq("id", e!.id)
      .single<{ title: string }>();
    expect(after!.title).toBe("Admin Edited");
  });
});
