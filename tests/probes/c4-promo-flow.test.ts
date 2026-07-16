/**
 * C4 probes — the flagship promo flow works end-to-end for an anon
 * coach clicking an email link.
 *
 * Flow:
 *   1. Admin approves a CSV, promo_codes rows generate + status='sent'
 *   2. Anon caller resolves the token via `promo_landing_info` and
 *      gets back event + email (safe: nothing they don't already know)
 *   3. Coach signs up + verifies email == promo email
 *   4. `claim_promo` links the promo to their user_id, flips status
 *      to 'active', and logs a funnel event
 *   5. Coach publishes a review and `apply_promo_to_review` stamps
 *      guru_review + flips promo to 'applied'
 */
import { afterAll, describe, expect, it } from "vitest";
import { anon, createUser, purge, seedTournamentAndEvent, service } from "../harness";
import { randomUUID } from "node:crypto";

const users: string[] = [];
afterAll(() => purge(users));

describe("C4 · promo landing + verified review flow", () => {
  it("anon caller can resolve token to event + email hint", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client, {
      premium: true,
    });
    const svc = service();
    const targetEmail = `coach-${randomUUID()}@local.test`;
    const token = `T-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const { data: csv } = await svc
      .from("submitted_csvs")
      .insert({
        ed_id: ed.id,
        event_id: eventId,
        file_path: "probe://",
        raw_emails: [targetEmail],
        status: "approved",
      })
      .select("id")
      .single();
    await svc.from("promo_codes").insert({
      submitted_csv_id: csv!.id,
      event_id: eventId,
      email: targetEmail,
      pretty_code: "ABC12345",
      url_token: token,
      status: "sent",
    });

    const anonClient = anon();
    const { data, error } = await anonClient.rpc("promo_landing_info", {
      p_token: token,
    });
    expect(error).toBeNull();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row).not.toBeNull();
    expect(row.event_id).toBe(eventId);
    expect(row.email).toBe(targetEmail);
  });

  it("claim_promo rejects a caller whose auth email doesn't match", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const wrongCoach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(wrongCoach.id);
    const { eventId } = await seedTournamentAndEvent(ed.client, {
      premium: true,
    });
    const svc = service();
    const targetEmail = `intended-${randomUUID()}@local.test`;
    const token = `T-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const { data: csv } = await svc
      .from("submitted_csvs")
      .insert({
        ed_id: ed.id,
        event_id: eventId,
        file_path: "probe://",
        raw_emails: [targetEmail],
        status: "approved",
      })
      .select("id")
      .single();
    await svc.from("promo_codes").insert({
      submitted_csv_id: csv!.id,
      event_id: eventId,
      email: targetEmail,
      pretty_code: "XYZ99999",
      url_token: token,
      status: "sent",
    });

    const { error } = await wrongCoach.client.rpc("claim_promo", {
      p_token: token,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("legit path: anon coach signs up with the target email, claim_promo links + publishes a verified review", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const { eventId } = await seedTournamentAndEvent(ed.client, {
      premium: true,
    });
    const svc = service();
    const targetEmail = `flagship-${randomUUID()}@local.test`;
    const token = `T-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const { data: csv } = await svc
      .from("submitted_csvs")
      .insert({
        ed_id: ed.id,
        event_id: eventId,
        file_path: "probe://",
        raw_emails: [targetEmail],
        status: "approved",
      })
      .select("id")
      .single();
    const { data: promo } = await svc
      .from("promo_codes")
      .insert({
        submitted_csv_id: csv!.id,
        event_id: eventId,
        email: targetEmail,
        pretty_code: "GOODCODE",
        url_token: token,
        status: "sent",
      })
      .select("id")
      .single();

    // Simulate the coach signing up via the anon promo landing → signup.
    const coach = await createUser({
      email: targetEmail,
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);

    // claim_promo now succeeds.
    const { data: claimData, error: claimErr } = await coach.client.rpc(
      "claim_promo",
      { p_token: token },
    );
    expect(claimErr).toBeNull();
    const row = Array.isArray(claimData) ? claimData[0] : claimData;
    expect(row.promo_id).toBe(promo!.id);
    expect(row.event_id).toBe(eventId);

    // promo now points at the coach + status=active
    const { data: promoAfter } = await svc
      .from("promo_codes")
      .select("status, user_id")
      .eq("id", promo!.id)
      .single();
    expect(promoAfter!.status).toBe("active");
    expect(promoAfter!.user_id).toBe(coach.id);

    // Coach publishes a review.
    const { data: review } = await coach.client
      .from("reviews")
      .insert({
        event_id: eventId,
        author_id: coach.id,
        status: "published",
        rating_fields: 5,
        rating_facilities: 5,
        rating_management: 5,
        rating_competition: 5,
        rating_diversity: 5,
        rating_cost_value: 5,
        review_title: "Great event",
        review_body: "Loved it",
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
      })
      .select("id")
      .single();

    const { error: applyErr } = await coach.client.rpc("apply_promo_to_review", {
      p_review: review!.id,
      p_promo: promo!.id,
    });
    expect(applyErr).toBeNull();

    const { data: promoFinal } = await svc
      .from("promo_codes")
      .select("status, applied_at")
      .eq("id", promo!.id)
      .single();
    expect(promoFinal!.status).toBe("applied");
    expect(promoFinal!.applied_at).not.toBeNull();
    const { data: revFinal } = await svc
      .from("reviews")
      .select("guru_review")
      .eq("id", review!.id)
      .single();
    expect(revFinal!.guru_review).toBe(true);
  });
});
