/**
 * C1 probe — signup as `user_type: 'admin'` must NEVER produce an
 * admin profile.
 *
 * This is the exact exploit path the original audit called out and
 * that RG1 confirmed still worked pre-fix: an anonymous caller uses
 * the public anon key to call `auth.signUp` with metadata that
 * requests an admin role, and the `handle_new_user` trigger picks
 * that up when writing the profile. The remediated trigger forces
 * `attendee`/`event_director`, never `admin`.
 */
import { afterAll, describe, expect, it } from "vitest";
import { anon, purge, service } from "../harness";
import { randomUUID } from "node:crypto";

const created: string[] = [];
afterAll(() => purge(created));

describe("C1 · signup privilege escalation", () => {
  it("signUp with user_type=admin lands as attendee, not admin", async () => {
    const client = anon();
    const email = `c1-${randomUUID()}@local.test`;
    const { data, error } = await client.auth.signUp({
      email,
      password: "TgTest123",
      options: {
        data: { user_type: "admin", role_title: "coach", first_name: "Mal" },
      },
    });
    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
    if (data.user) created.push(data.user.id);

    // Read the profile via service role (bypasses RLS) so the assert
    // sees ground truth.
    const svc = service();
    const { data: profile } = await svc
      .from("profiles")
      .select("user_type, role_title")
      .eq("id", data.user!.id)
      .single();
    expect(profile).not.toBeNull();
    expect(profile!.user_type).toBe("attendee");
    // Trigger should also coerce role_title into the attendee-valid
    // set — coach is fine here.
    expect(profile!.role_title).toBe("coach");
  });

  it("signUp with user_type=event_director & valid role stays as ED", async () => {
    const client = anon();
    const email = `c1-ed-${randomUUID()}@local.test`;
    const { data, error } = await client.auth.signUp({
      email,
      password: "TgTest123",
      options: {
        data: {
          user_type: "event_director",
          role_title: "event_director",
        },
      },
    });
    expect(error).toBeNull();
    if (data.user) created.push(data.user.id);

    const svc = service();
    const { data: profile } = await svc
      .from("profiles")
      .select("user_type, role_title")
      .eq("id", data.user!.id)
      .single();
    expect(profile!.user_type).toBe("event_director");
    expect(profile!.role_title).toBe("event_director");
  });

  it("signUp with mismatched role_title (attendee + event_director role) coerces to safe default", async () => {
    const client = anon();
    const email = `c1-mismatch-${randomUUID()}@local.test`;
    const { data, error } = await client.auth.signUp({
      email,
      password: "TgTest123",
      options: {
        data: { user_type: "attendee", role_title: "event_director" },
      },
    });
    expect(error).toBeNull();
    if (data.user) created.push(data.user.id);

    const svc = service();
    const { data: profile } = await svc
      .from("profiles")
      .select("user_type, role_title")
      .eq("id", data.user!.id)
      .single();
    expect(profile!.user_type).toBe("attendee");
    expect(profile!.role_title).toBe("coach");
  });
});
