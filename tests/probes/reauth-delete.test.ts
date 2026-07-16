/**
 * S8.2 — delete-my-account requires re-auth (M4). We call
 * signInWithPassword directly here to mirror what the server action
 * does after the client hands the password back: wrong password →
 * error; correct password → the follow-up RPC runs successfully.
 */
import { afterAll, describe, expect, it } from "vitest";
import { anon, createUser, purge, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

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

  it("correct password allows the follow-up soft_delete_attendee RPC to run", async () => {
    const attendee = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(attendee.id);
    const check = await anon().auth.signInWithPassword({
      email: attendee.email,
      password: attendee.password,
    });
    expect(check.error).toBeNull();
    const rpc = await attendee.client.rpc("soft_delete_attendee", {
      target_user: attendee.id,
    });
    expect(rpc.error).toBeNull();
    // Profile is scrubbed (name null, blocked=true).
    const { data: p } = await service()
      .from("profiles")
      .select("first_name, blocked")
      .eq("id", attendee.id)
      .single();
    expect(p!.first_name).toBeNull();
    expect(p!.blocked).toBe(true);
  });
});
