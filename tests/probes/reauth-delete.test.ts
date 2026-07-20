/**
 * S8.2 — delete-my-account requires re-auth (M4), and account deletion
 * is a TRUE delete (Option B, supersedes the S6.1 anonymize model):
 * the user's review + comment ROWS are removed and the reviews delete
 * trigger recomputes the affected event's aggregates. The profile is
 * still scrubbed + blocked, and the durable platform counter
 * (published_reviews_total) never decrements.
 *
 * We call signInWithPassword directly to mirror what the server action
 * does after the client hands the password back: wrong password →
 * error; correct password → the follow-up RPC runs.
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  anon,
  createUser,
  purge,
  seedTournamentAndEvent,
  service,
} from "../harness";

const users: string[] = [];
const tournaments: string[] = [];
const reviews: string[] = [];

afterAll(async () => {
  const svc = service();
  for (const id of reviews) {
    await svc.from("reviews").delete().eq("id", id);
  }
  for (const id of tournaments) {
    await svc.from("events").delete().eq("tournament_id", id);
    await svc.from("tournaments").delete().eq("id", id);
  }
  await purge(users);
});

/** Published review with all six categories at `rating`, so the
 * computed overall equals `rating` exactly. */
async function seedPublishedReview(
  eventId: string,
  authorId: string,
  rating: number,
): Promise<string> {
  const { data, error } = await service()
    .from("reviews")
    .insert({
      event_id: eventId,
      author_id: authorId,
      status: "published",
      review_title: `Probe rating ${rating}`,
      review_body: "True-delete probe review.",
      rating_fields: rating,
      rating_facilities: rating,
      rating_management: rating,
      rating_competition: rating,
      rating_diversity: rating,
      rating_cost_value: rating,
      reviewer_user_type: "attendee",
      reviewer_role: "coach",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`seedPublishedReview: ${error.message}`);
  reviews.push(data!.id);
  return data!.id;
}

async function eventAggregates(eventId: string) {
  const { data } = await service()
    .from("events")
    .select("review_count, general_rating")
    .eq("id", eventId)
    .single<{ review_count: number; general_rating: number | null }>();
  return {
    count: data!.review_count,
    rating: data!.general_rating === null ? null : Number(data!.general_rating),
  };
}

async function publishedTotal(): Promise<number> {
  const { data } = await service()
    .from("platform_counters")
    .select("value")
    .eq("key", "published_reviews_total")
    .single<{ value: number }>();
  return data!.value;
}

describe("Re-auth before delete — S8.2 (M4)", () => {
  it("wrong password on signInWithPassword surfaces an AuthApiError", async () => {
    const attendee = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attendee.id);
    const check = await anon().auth.signInWithPassword({
      email: attendee.email,
      password: "not-the-real-one",
    });
    expect(check.error).not.toBeNull();
  });
});

describe("Account delete = true-delete + recompute — Option B", () => {
  it("soft_delete_attendee removes the user's rows and the event score recomputes", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { tournamentId, eventId } = await seedTournamentAndEvent(ed.client);
    tournaments.push(tournamentId);

    const leaver = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(leaver.id);
    const stayer = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(stayer.id);

    // Stayer rates 3, leaver rates 5 → event averages 4. The leaver
    // also comments on the stayer's review.
    const stayerReview = await seedPublishedReview(eventId, stayer.id, 3);
    const leaverReview = await seedPublishedReview(eventId, leaver.id, 5);
    const svc = service();
    const { error: commentErr } = await svc.from("comments").insert({
      review_id: stayerReview,
      author_id: leaver.id,
      body: "Comment that must not outlive its author's account.",
    });
    expect(commentErr).toBeNull();

    const before = await eventAggregates(eventId);
    expect(before.count).toBe(2);
    expect(before.rating).toBe(4);
    const counterBefore = await publishedTotal();

    // Re-auth (the M4 gate), then the delete RPC as the user.
    const check = await anon().auth.signInWithPassword({
      email: leaver.email,
      password: leaver.password,
    });
    expect(check.error).toBeNull();
    const rpc = await leaver.client.rpc("soft_delete_attendee", {
      target_user: leaver.id,
    });
    expect(rpc.error).toBeNull();

    // The leaver's review + comment ROWS are gone…
    const { data: leftReviews } = await svc
      .from("reviews")
      .select("id")
      .eq("author_id", leaver.id);
    expect(leftReviews ?? []).toHaveLength(0);
    const { data: gone } = await svc
      .from("reviews")
      .select("id")
      .eq("id", leaverReview);
    expect(gone ?? []).toHaveLength(0);
    const { data: leftComments } = await svc
      .from("comments")
      .select("id")
      .eq("author_id", leaver.id);
    expect(leftComments ?? []).toHaveLength(0);

    // …the stayer's review survives…
    const { data: kept } = await svc
      .from("reviews")
      .select("id")
      .eq("id", stayerReview);
    expect(kept ?? []).toHaveLength(1);

    // …and the delete trigger recomputed the event: one fewer review,
    // and the 5-rater leaving LOWERS the average (4 → 3).
    const after = await eventAggregates(eventId);
    expect(after.count).toBe(1);
    expect(after.rating).toBe(3);

    // Profile PII is scrubbed and the account blocked (scrub still runs).
    const { data: p } = await svc
      .from("profiles")
      .select("first_name, last_name, blocked")
      .eq("id", leaver.id)
      .single<{ first_name: string | null; last_name: string | null; blocked: boolean }>();
    expect(p!.first_name).toBeNull();
    expect(p!.last_name).toBeNull();
    expect(p!.blocked).toBe(true);

    // The durable platform counter never decrements.
    expect(await publishedTotal()).toBe(counterBefore);
  });

  it("delete_ed_account true-deletes the ED's own review too", async () => {
    const host = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(host.id);
    const { tournamentId, eventId } = await seedTournamentAndEvent(host.client);
    tournaments.push(tournamentId);

    const leavingEd = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(leavingEd.id);
    const edReview = await seedPublishedReview(eventId, leavingEd.id, 5);

    const rpc = await leavingEd.client.rpc("delete_ed_account", {
      target_user: leavingEd.id,
    });
    expect(rpc.error).toBeNull();

    const svc = service();
    const { data: gone } = await svc
      .from("reviews")
      .select("id")
      .eq("id", edReview);
    expect(gone ?? []).toHaveLength(0);
    const after = await eventAggregates(eventId);
    expect(after.count).toBe(0);

    const { data: p } = await svc
      .from("profiles")
      .select("first_name, blocked")
      .eq("id", leavingEd.id)
      .single<{ first_name: string | null; blocked: boolean }>();
    expect(p!.first_name).toBeNull();
    expect(p!.blocked).toBe(true);
  });
});
