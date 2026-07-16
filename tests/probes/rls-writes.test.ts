/**
 * RLS write probes — the client column allow-lists + row-level
 * policies deny the exploits BUILD-PLAN §2.5 called out:
 *   - user_type / role_title / dob / blocked cannot be written by
 *     authenticated after onboarding is complete
 *   - guru_review / promo_id cannot be written by the client at all
 *   - a coach cannot INSERT a review with someone else's author_id
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

describe("Table-level RLS + column grants", () => {
  it("authenticated user cannot UPDATE user_type on their own profile", async () => {
    const attendee = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attendee.id);
    const { error } = await attendee.client
      .from("profiles")
      .update({ user_type: "admin" })
      .eq("id", attendee.id);
    // Column grant excludes user_type → 42501 or PGRST error.
    expect(error).not.toBeNull();
    const { data } = await service()
      .from("profiles")
      .select("user_type")
      .eq("id", attendee.id)
      .single();
    expect(data!.user_type).toBe("attendee");
  });

  it("authenticated user cannot UPDATE role_title once onboarding_completed", async () => {
    const attendee = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attendee.id);
    const { error } = await attendee.client
      .from("profiles")
      .update({ role_title: "event_director" })
      .eq("id", attendee.id);
    expect(error).not.toBeNull();
  });

  it("authenticated user cannot write guru_review directly", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
    const { data: review } = await coach.client
      .from("reviews")
      .insert({
        event_id: eventId,
        author_id: coach.id,
        status: "draft",
        rating_fields: 3,
        rating_facilities: 3,
        rating_management: 3,
        rating_competition: 3,
        rating_diversity: 3,
        rating_cost_value: 3,
        review_title: "T",
        review_body: "B",
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
      })
      .select("id")
      .single();
    const { error } = await coach.client
      .from("reviews")
      .update({ guru_review: true })
      .eq("id", review!.id);
    expect(error).not.toBeNull();
  });

  it("authenticated user cannot INSERT a review with a different author_id", async () => {
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
    // Need an event; ED as service.
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
    const { error } = await attacker.client.from("reviews").insert({
      event_id: eventId,
      author_id: victim.id, // impersonation attempt
      status: "draft",
      review_title: "Fake",
      review_body: "Fake",
      reviewer_user_type: "attendee",
      reviewer_role: "coach",
    });
    expect(error).not.toBeNull();
  });

  it("anon cannot INSERT rows into profiles / events / reviews", async () => {
    const { anon } = await import("../harness");
    const client = anon();
    const attempts = await Promise.all([
      client.from("profiles").insert({ id: crypto.randomUUID() }),
      client.from("events").insert({ tournament_id: crypto.randomUUID(), title: "x" }),
      client.from("reviews").insert({ event_id: crypto.randomUUID(), status: "draft" }),
    ]);
    for (const a of attempts) {
      expect(a.error).not.toBeNull();
    }
  });
});
