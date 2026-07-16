/**
 * H2 probe — an ED skipping the distance / team info on step 3 still
 * advances to step 4 because `preferences_completed` flips
 * server-side. This is a schema-level guarantee: the column exists
 * and is in the client UPDATE grant.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

describe("H2 · onboarding step 3 completion", () => {
  it("flipping preferences_completed advances the wizard past step 3", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
    });
    users.push(ed.id);
    // Set the mandatory step 1 + 2 fields via service so the wizard
    // considers those steps done.
    const svc = service();
    await svc
      .from("profiles")
      .update({
        first_name: "Ed",
        last_name: "Owen",
        organization_title: "Test Org",
        location_formatted: "KC, MO",
        user_gender: "male",
        dob: "1990-01-01",
        role_title: "event_director",
      })
      .eq("id", ed.id);

    // As the ED themselves — flip preferences_completed via the
    // client update grant.
    const { error } = await ed.client
      .from("profiles")
      .update({ preferences_completed: true })
      .eq("id", ed.id);
    expect(error).toBeNull();
    const { data } = await svc
      .from("profiles")
      .select("preferences_completed")
      .eq("id", ed.id)
      .single();
    expect(data!.preferences_completed).toBe(true);
  });
});
