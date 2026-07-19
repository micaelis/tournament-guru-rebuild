/**
 * admin_search_users_by_email — the narrow email→id bridge behind the
 * admin Users search (emails live in auth.users, unreadable to the
 * app's authenticated client).
 *
 * The function is the PII boundary here, so the probe pins both sides:
 * only admins get ANY result (anon and non-admin raise 42501), and the
 * result is ids ONLY — even for an admin, the return shape can never
 * carry an email.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createUser, purge } from "../harness";
import type { SupabaseClient } from "@supabase/supabase-js";

const users: string[] = [];

let admin: { id: string; client: SupabaseClient };
let attendee: { id: string; client: SupabaseClient };
let ed: { id: string; client: SupabaseClient };
let needle: { id: string; email: string };

beforeAll(async () => {
  admin = await createUser({ becomeAdmin: true, completeOnboarding: true });
  attendee = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  ed = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  const target = await createUser({
    email: `needle-${Date.now()}@probe.test`,
    completeOnboarding: true,
    role: "coach",
  });
  needle = { id: target.id, email: target.email };
  users.push(admin.id, attendee.id, ed.id, target.id);
});

afterAll(async () => {
  await purge(users);
});

describe("admin_search_users_by_email", () => {
  it("anon is rejected", async () => {
    const { data, error } = await anon().rpc("admin_search_users_by_email", {
      term: "needle",
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("an attendee and an ED are rejected (42501)", async () => {
    for (const caller of [attendee, ed]) {
      const { data, error } = await caller.client.rpc(
        "admin_search_users_by_email",
        { term: "needle" },
      );
      expect(error).not.toBeNull();
      expect(error!.code).toBe("42501");
      expect(data).toBeNull();
    }
  });

  it("an admin resolves an email substring to the matching id — ids only", async () => {
    const { data, error } = await admin.client.rpc(
      "admin_search_users_by_email",
      { term: needle.email.slice(0, 12) },
    );
    expect(error).toBeNull();
    expect(data).toContain(needle.id);
    // The return shape is uuid strings — no object could smuggle an email.
    for (const row of data as unknown[]) {
      expect(typeof row).toBe("string");
      expect(row as string).not.toContain("@");
    }
  });

  it("a blank term matches nobody (no full-directory dump)", async () => {
    const { data, error } = await admin.client.rpc(
      "admin_search_users_by_email",
      { term: "   " },
    );
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
