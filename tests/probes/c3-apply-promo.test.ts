/**
 * C3 probes — apply_promo_to_review must validate the caller owns the
 * review, the promo belongs to them, the promo's event matches, and
 * the promo status is a live one. No user should be able to stamp a
 * Guru badge on somebody else's review.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";
import { randomUUID } from "node:crypto";

const users: string[] = [];
afterAll(() => purge(users));

async function seedPromo(
  edClient: Awaited<ReturnType<typeof createUser>>["client"],
  eventId: string,
  email: string,
): Promise<{ promoId: string; token: string; pretty: string }> {
  const svc = service();
  const { data: userId } = await edClient.auth.getUser();
  // Need a submitted_csv row to fk against — insert one straight.
  const { data: csv } = await svc
    .from("submitted_csvs")
    .insert({
      ed_id: userId.user!.id,
      event_id: eventId,
      file_path: `probe://csv-${randomUUID()}`,
      raw_emails: [email],
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
      email,
      pretty_code: pretty,
      url_token: token,
      status: "sent",
    })
    .select("id")
    .single();
  return { promoId: promo!.id, token, pretty };
}

describe("C3 · apply_promo_to_review", () => {
  it("caller who does not own the review is refused", async () => {
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
    const attacker = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attacker.id);
    const { eventId } = await seedTournamentAndEvent(ed.client, {
      premium: true,
    });
    const { promoId } = await seedPromo(ed.client, eventId, coach.email);

    // Coach writes their own review first.
    const { data: review, error: revErr } = await coach.client
      .from("reviews")
      .insert({
        event_id: eventId,
        author_id: coach.id,
        status: "draft",
        rating_fields: 4,
        rating_facilities: 4,
        rating_management: 4,
        rating_competition: 4,
        rating_diversity: 4,
        rating_cost_value: 4,
        review_title: "Ok",
        review_body: "Basic body",
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
      })
      .select("id")
      .single();
    expect(revErr).toBeNull();

    // Attacker tries to apply the coach's promo to the coach's review.
    const { error } = await attacker.client.rpc("apply_promo_to_review", {
      p_review: review!.id,
      p_promo: promoId,
    });
    expect(error).not.toBeNull();
    // "review not yours" (42501) is the expected code.
    expect(error!.code).toBe("42501");

    // Coach's review still has guru_review=false.
    const { data: r } = await service()
      .from("reviews")
      .select("guru_review, promo_id")
      .eq("id", review!.id)
      .single();
    expect(r!.guru_review).toBe(false);
    expect(r!.promo_id).toBeNull();
  });

  it("caller applying a promo issued to a different email is refused", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const otherCoach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(otherCoach.id);
    const badCoach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(badCoach.id);
    const { eventId } = await seedTournamentAndEvent(ed.client, {
      premium: true,
    });
    // Promo issued to otherCoach.
    const { promoId } = await seedPromo(ed.client, eventId, otherCoach.email);

    // badCoach writes their own review + tries to apply otherCoach's promo.
    const { data: review } = await badCoach.client
      .from("reviews")
      .insert({
        event_id: eventId,
        author_id: badCoach.id,
        status: "draft",
        rating_fields: 4,
        rating_facilities: 4,
        rating_management: 4,
        rating_competition: 4,
        rating_diversity: 4,
        rating_cost_value: 4,
        review_title: "Ok",
        review_body: "Body",
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
      })
      .select("id")
      .single();

    const { error } = await badCoach.client.rpc("apply_promo_to_review", {
      p_review: review!.id,
      p_promo: promoId,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("legit path: coach owns review + promo email matches → guru_review flips", async () => {
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
    const { eventId } = await seedTournamentAndEvent(ed.client, {
      premium: true,
    });
    const { promoId } = await seedPromo(ed.client, eventId, coach.email);

    const { data: review } = await coach.client
      .from("reviews")
      .insert({
        event_id: eventId,
        author_id: coach.id,
        status: "draft",
        rating_fields: 5,
        rating_facilities: 5,
        rating_management: 5,
        rating_competition: 5,
        rating_diversity: 5,
        rating_cost_value: 5,
        review_title: "Great",
        review_body: "Legit",
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
      })
      .select("id")
      .single();

    const { error } = await coach.client.rpc("apply_promo_to_review", {
      p_review: review!.id,
      p_promo: promoId,
    });
    expect(error).toBeNull();

    const { data: r } = await service()
      .from("reviews")
      .select("guru_review, promo_id")
      .eq("id", review!.id)
      .single();
    expect(r!.guru_review).toBe(true);
    expect(r!.promo_id).toBe(promoId);
  });
});
