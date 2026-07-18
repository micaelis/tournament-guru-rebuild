/**
 * user_teams grant + RLS probes — Round-2 #5 ("permission denied for
 * table user_teams" on ED onboarding step 3). The break was the
 * postgres-default-privileges grant gap (fixed by 20260718000005);
 * these probes lock the contract so a grant regression fails CI
 * instead of breaking onboarding:
 *   - authenticated can INSERT / SELECT / DELETE their OWN rows
 *     (the step-3 replace-all write path)
 *   - cannot INSERT rows for another profile
 *   - cannot SELECT another user's rows
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

async function onboardingStep3User(role: string, userType: string) {
  const user = await createUser({
    metadata: { user_type: userType, role_title: role },
  });
  users.push(user.id);
  return user;
}

describe("user_teams grants + RLS (onboarding step 3)", () => {
  it("ED can insert, read back, and replace their own team rows", async () => {
    const ed = await onboardingStep3User("event_director", "event_director");

    const rows = [1, 2, 3].map((slot) => ({
      profile_id: ed.id,
      slot,
      team_gender: "boys",
      age: "U14",
      competition_level: "middle",
    }));
    const { error: insertError } = await ed.client
      .from("user_teams")
      .insert(rows);
    expect(insertError).toBeNull();

    const { data, error: readError } = await ed.client
      .from("user_teams")
      .select("slot")
      .eq("profile_id", ed.id)
      .order("slot");
    expect(readError).toBeNull();
    expect(data!.map((r) => r.slot)).toEqual([1, 2, 3]);

    // Replace-all semantics: delete + re-insert one slot.
    const { error: deleteError } = await ed.client
      .from("user_teams")
      .delete()
      .eq("profile_id", ed.id);
    expect(deleteError).toBeNull();
    const { error: reinsertError } = await ed.client
      .from("user_teams")
      .insert([{ profile_id: ed.id, slot: 1, team_gender: "girls" }]);
    expect(reinsertError).toBeNull();
  });

  it("attendee step-3 write path works too (same table, same policy)", async () => {
    const coach = await onboardingStep3User("coach", "attendee");
    const { error } = await coach.client
      .from("user_teams")
      .insert([{ profile_id: coach.id, slot: 1, age: "U12" }]);
    expect(error).toBeNull();
  });

  it("cannot INSERT team rows for another profile", async () => {
    const victim = await onboardingStep3User("coach", "attendee");
    const attacker = await onboardingStep3User("coach", "attendee");
    const { error } = await attacker.client
      .from("user_teams")
      .insert([{ profile_id: victim.id, slot: 2, team_gender: "boys" }]);
    expect(error).not.toBeNull();
  });

  it("cannot SELECT or DELETE another user's team rows", async () => {
    const owner = await onboardingStep3User("coach", "attendee");
    const snoop = await onboardingStep3User("coach", "attendee");
    await owner.client
      .from("user_teams")
      .insert([{ profile_id: owner.id, slot: 1, team_gender: "girls" }]);

    const { data } = await snoop.client
      .from("user_teams")
      .select("id")
      .eq("profile_id", owner.id);
    expect(data).toEqual([]);

    const { error: deleteError } = await snoop.client
      .from("user_teams")
      .delete()
      .eq("profile_id", owner.id);
    expect(deleteError).toBeNull(); // RLS filters silently — but…
    const { data: still } = await owner.client
      .from("user_teams")
      .select("id")
      .eq("profile_id", owner.id);
    expect(still!.length).toBe(1); // …the row must survive.
  });
});
