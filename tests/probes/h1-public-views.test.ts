/**
 * H1 probes — public reviewer / comment / host identity comes through
 * the SECURITY DEFINER views. Anon callers see first_name + org +
 * photo, never last_name / email / dob. Direct reads of the profiles
 * table for these fields return nothing (RLS-protected).
 */
import { afterAll, describe, expect, it } from "vitest";
import { anon, createUser, purge, seedTournamentAndEvent, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

describe("H1 · public identity views", () => {
  it("anon SELECT on review_author_public returns first_name + org for a published review", async () => {
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
      firstName: "Publicly",
      lastName: "Named",
      organization: "Neighborhood FC",
    });
    users.push(coach.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
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
        review_title: "Fine",
        review_body: "Fine",
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
      })
      .select("id")
      .single();

    const anonClient = anon();
    const { data, error } = await anonClient
      .from("review_author_public")
      .select("first_name, organization_title, profile_photo_url, reviewer_role")
      .eq("review_id", review!.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.first_name).toBe("Publicly");
    expect(data!.organization_title).toBe("Neighborhood FC");
    expect(data!.reviewer_role).toBe("coach");
  });

  it("anon SELECT on profiles for the same reviewer returns nothing", async () => {
    // Direct read of profiles is RLS-gated → anon gets no rows.
    const anonClient = anon();
    const { data } = await anonClient
      .from("profiles")
      .select("id, last_name")
      .limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("anon SELECT on public_event_owners returns the ED's public fields but not last_name", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
      firstName: "Public",
      lastName: "SecretName",
      organization: "The Org",
    });
    users.push(ed.id);
    const anonClient = anon();
    const { data, error } = await anonClient
      .from("public_event_owners")
      .select("id, first_name, organization_title, org_description")
      .eq("id", ed.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.first_name).toBe("Public");
    // Selecting last_name from the view should fail because it's not
    // in the projection.
    const { error: lastErr } = await anonClient
      .from("public_event_owners")
      .select("last_name")
      .eq("id", ed.id)
      .maybeSingle();
    expect(lastErr).not.toBeNull();
  });
});
