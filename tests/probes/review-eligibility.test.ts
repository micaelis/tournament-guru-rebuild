/**
 * Review eligibility probes — RLS enforces:
 *   - Only attendee-type, non-blocked users can INSERT reviews
 *   - EDs and admins cannot write reviews
 *   - Guru/verified reviews blocked on non-paid events
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

function reviewPayload(eventId: string, authorId: string) {
  return {
    event_id: eventId,
    author_id: authorId,
    status: "published" as const,
    rating_fields: 4,
    rating_facilities: 4,
    rating_management: 4,
    rating_competition: 4,
    rating_diversity: 4,
    rating_cost_value: 4,
    review_title: "Probe review",
    review_body: "This is a probe review for eligibility testing.",
    would_return: true,
    reviewer_user_type: "attendee",
    reviewer_role: "coach",
  };
}

describe("Review eligibility — who can write", () => {
  it("attendee (coach) CAN insert a review", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);

    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);

    const { error } = await coach.client
      .from("reviews")
      .insert(reviewPayload(eventId, coach.id));
    expect(error).toBeNull();
  });

  it("event director CANNOT insert a review", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);

    const otherEd = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(otherEd.id);
    const { eventId } = await seedTournamentAndEvent(otherEd.client);

    const { error } = await ed.client
      .from("reviews")
      .insert(reviewPayload(eventId, ed.id));
    expect(error).not.toBeNull();
  });

  it("admin CANNOT insert a review", async () => {
    const admin = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
      becomeAdmin: true,
    });
    users.push(admin.id);

    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);

    const { error } = await admin.client
      .from("reviews")
      .insert(reviewPayload(eventId, admin.id));
    expect(error).not.toBeNull();
  });

  it("blocked attendee CANNOT insert a review", async () => {
    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);
    await service()
      .from("profiles")
      .update({ blocked: true })
      .eq("id", coach.id);

    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);

    const { error } = await coach.client
      .from("reviews")
      .insert(reviewPayload(eventId, coach.id));
    expect(error).not.toBeNull();
  });
});

async function seedPromo(edId: string, eventId: string, coachEmail: string, coachId: string) {
  const svc = service();
  const { data: csv } = await svc
    .from("submitted_csvs")
    .insert({
      ed_id: edId,
      event_id: eventId,
      file_path: `probe://csv-${randomUUID()}`,
      raw_emails: [coachEmail],
      status: "approved",
    })
    .select("id")
    .single();
  const token = `T-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const pretty = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: promo } = await svc
    .from("promo_codes")
    .insert({
      submitted_csv_id: csv!.id,
      event_id: eventId,
      email: coachEmail,
      pretty_code: pretty,
      url_token: token,
      user_id: coachId,
      status: "sent",
    })
    .select("id")
    .single();
  return promo!.id;
}

describe("Guru/verified gating — paid events only", () => {
  it("apply_promo_to_review rejects a non-paid event", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client, { premium: false });

    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);

    const { data: review } = await coach.client
      .from("reviews")
      .insert(reviewPayload(eventId, coach.id))
      .select("id")
      .single();

    const promoId = await seedPromo(ed.id, eventId, coach.email, coach.id);

    const { error } = await coach.client.rpc("apply_promo_to_review", {
      p_review: review!.id,
      p_promo: promoId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("verified reviews require a paid event");
  });

  it("apply_promo_to_review succeeds on a paid (premium) event", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client, { premium: true });

    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);

    const { data: review } = await coach.client
      .from("reviews")
      .insert(reviewPayload(eventId, coach.id))
      .select("id")
      .single();

    const promoId = await seedPromo(ed.id, eventId, coach.email, coach.id);

    const { error } = await coach.client.rpc("apply_promo_to_review", {
      p_review: review!.id,
      p_promo: promoId,
    });
    expect(error).toBeNull();
  });
});
