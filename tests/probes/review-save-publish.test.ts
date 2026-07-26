/**
 * Review save/publish probes — the author's own draft→published
 * lifecycle works through the REAL `saveReview` action, without
 * widening the reviews column grants.
 *
 * The regression this pins: `saveReview`'s UPDATE path reused the full
 * INSERT row, so the SET list carried the INSERT-only identity columns
 * (event_id, author_id, reviewer_user_type, reviewer_role). Column
 * privileges are checked before RLS, so EVERY edit of an existing
 * review — saving a draft again or publishing it — died with
 * "permission denied for table reviews" (42501), even though the
 * values were unchanged. Mutation check: reverting the update payload
 * to the full row flips the draft-edit + publish tests red.
 *
 * The deny half stays deliberately narrow: guru_review / promo_id are
 * definer-RPC-only (apply_promo_to_review), and RLS row-filters an
 * update aimed at someone else's review to a no-op.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const ctl = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerAuthClient: async () => ctl.client!,
  createAnonServerClient: () => ctl.client!,
}));

import { saveReview } from "@/lib/reviews/actions";

type Actor = { id: string; client: SupabaseClient };

const users: string[] = [];
let tournamentId: string;
let eventId: string;
let author: Actor;
let otherAttendee: Actor;

/** Run a server action as `actor` (the action reads the mocked client). */
async function as<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  ctl.client = actor.client;
  return fn();
}

function reviewForm(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** All six category ratings + would_return, as the publish form posts. */
const fullRatings = {
  rating_fields: "5",
  rating_facilities: "4",
  rating_management: "5",
  rating_competition: "4",
  rating_diversity: "3",
  rating_cost_value: "4",
  would_return: "yes",
};

beforeAll(async () => {
  const ed = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  users.push(ed.id);
  author = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  users.push(author.id);
  otherAttendee = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  users.push(otherAttendee.id);
  // Ended 3 days ago — inside the 30-day edit window, so published
  // rows stay editable and the probe exercises the update path.
  const seeded = await seedTournamentAndEvent(ed.client, {
    startDaysFromNow: -5,
  });
  tournamentId = seeded.tournamentId;
  eventId = seeded.eventId;
});

afterAll(async () => {
  const svc = service();
  await svc.from("reviews").delete().eq("event_id", eventId);
  await svc.from("events").delete().eq("tournament_id", tournamentId);
  await svc.from("tournaments").delete().eq("id", tournamentId);
  await purge(users);
});

describe("review save/publish — author lifecycle through saveReview", () => {
  let reviewId: string;

  it("attendee creates a draft, then edits and re-saves it", async () => {
    const created = await as(author, () =>
      saveReview({}, reviewForm({
        intent: "draft",
        event_id: eventId,
        review_title: "First pass",
        review_body: "Initial draft body",
        rating_fields: "4",
      })),
    );
    expect(created.error).toBeUndefined();
    expect(created.fieldErrors).toBeUndefined();
    expect(created.savedId).toBeTruthy();
    reviewId = created.savedId!;

    // The re-save is the regression: an UPDATE of the existing row.
    const resaved = await as(author, () =>
      saveReview({}, reviewForm({
        intent: "draft",
        event_id: eventId,
        review_id: reviewId,
        review_title: "First pass",
        review_body: "Edited draft body",
        rating_fields: "3",
      })),
    );
    expect(resaved.error).toBeUndefined();
    expect(resaved.savedId).toBe(reviewId);

    const { data } = await service()
      .from("reviews")
      .select("status, review_body, rating_fields, published_at")
      .eq("id", reviewId)
      .single();
    expect(data!.status).toBe("draft");
    expect(data!.review_body).toBe("Edited draft body");
    expect(data!.rating_fields).toBe(3);
    expect(data!.published_at).toBeNull();
  });

  it("attendee publishes their draft; published_at is stamped by the trigger", async () => {
    const published = await as(author, () =>
      saveReview({}, reviewForm({
        intent: "publish",
        event_id: eventId,
        review_id: reviewId,
        review_title: "Great weekend",
        review_body: "Well-run event",
        ...fullRatings,
      })),
    );
    expect(published.error).toBeUndefined();
    expect(published.fieldErrors).toBeUndefined();
    expect(published.savedId).toBe(reviewId);

    const { data } = await service()
      .from("reviews")
      .select("status, published_at")
      .eq("id", reviewId)
      .single();
    expect(data!.status).toBe("published");
    expect(data!.published_at).not.toBeNull();
  });

  it("editing the published review inside the window keeps published_at", async () => {
    const { data: before } = await service()
      .from("reviews")
      .select("published_at")
      .eq("id", reviewId)
      .single();

    const edited = await as(author, () =>
      saveReview({}, reviewForm({
        intent: "publish",
        event_id: eventId,
        review_id: reviewId,
        review_title: "Great weekend",
        review_body: "Well-run event — updated",
        ...fullRatings,
      })),
    );
    expect(edited.error).toBeUndefined();
    expect(edited.savedId).toBe(reviewId);

    const { data: after } = await service()
      .from("reviews")
      .select("review_body, published_at")
      .eq("id", reviewId)
      .single();
    expect(after!.review_body).toBe("Well-run event — updated");
    expect(after!.published_at).toBe(before!.published_at);
  });

  it("the author cannot write guru_review or promo_id directly", async () => {
    const guru = await author.client
      .from("reviews")
      .update({ guru_review: true })
      .eq("id", reviewId);
    expect(guru.error).not.toBeNull();

    const promo = await author.client
      .from("reviews")
      .update({ promo_id: randomUUID() })
      .eq("id", reviewId);
    expect(promo.error).not.toBeNull();

    const { data } = await service()
      .from("reviews")
      .select("guru_review, promo_id")
      .eq("id", reviewId)
      .single();
    expect(data!.guru_review).toBe(false);
    expect(data!.promo_id).toBeNull();
  });

  it("another attendee cannot update the author's review (RLS row filter, no-op)", async () => {
    // Granted columns only — so the denial proven here is the ROW
    // policy, not the column privilege check.
    const { error } = await otherAttendee.client
      .from("reviews")
      .update({ status: "draft", review_body: "hijacked" })
      .eq("id", reviewId);
    expect(error).toBeNull();

    const { data } = await service()
      .from("reviews")
      .select("status, review_body")
      .eq("id", reviewId)
      .single();
    expect(data!.status).toBe("published");
    expect(data!.review_body).toBe("Well-run event — updated");
  });
});
