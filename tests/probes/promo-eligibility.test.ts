/**
 * promo_email_eligibility — the CSV pre-flight bridge (S3.2 → S10.12).
 *
 * Emails live in auth.users, unreadable to the app's clients, so this
 * SECURITY DEFINER RPC answers ONE question per input email: eligible /
 * wrong-user-type / blocked. Two contracts pinned here:
 *
 *  1. AUTHZ: anon and attendees are rejected; event hosts (ED, admin)
 *     may call.
 *  2. EXCLUSION + SHAPE: the spec §6.3 matrix — no account → eligible;
 *     non-blocked coach → eligible; blocked coach → blocked; ED /
 *     admin / non-coach role → wrong-user-type — and every returned
 *     row carries (email, status) ONLY, so no account data can leak.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createUser, purge, service } from "../harness";
import type { SupabaseClient } from "@supabase/supabase-js";

const users: string[] = [];

let ed: { id: string; email: string; client: SupabaseClient };
let admin: { id: string; email: string; client: SupabaseClient };
let coach: { id: string; email: string; client: SupabaseClient };
let blockedCoach: { id: string; email: string };
let teamManager: { id: string; email: string };

beforeAll(async () => {
  ed = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  admin = await createUser({ becomeAdmin: true, completeOnboarding: true });
  coach = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  blockedCoach = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  await service()
    .from("profiles")
    .update({ blocked: true })
    .eq("id", blockedCoach.id);
  teamManager = await createUser({
    metadata: { user_type: "attendee", role_title: "team_manager" },
    completeOnboarding: true,
    role: "team_manager",
  });
  users.push(ed.id, admin.id, coach.id, blockedCoach.id, teamManager.id);
});

afterAll(async () => {
  await purge(users);
});

describe("promo_email_eligibility · authz", () => {
  it("anon is rejected", async () => {
    const { data, error } = await anon().rpc("promo_email_eligibility", {
      p_emails: [coach.email],
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("an attendee (even a coach) is rejected (42501)", async () => {
    const { error } = await coach.client.rpc("promo_email_eligibility", {
      p_emails: [coach.email],
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("an ED and an admin may call", async () => {
    for (const caller of [ed, admin]) {
      const { data, error } = await caller.client.rpc(
        "promo_email_eligibility",
        { p_emails: ["nobody@probe.test"] },
      );
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    }
  });
});

describe("promo_email_eligibility · the §6.3 exclusion matrix", () => {
  it("classifies every account shape, in input order, ids-free", async () => {
    const inputs = [
      "unknown-address@probe.test", // no account
      coach.email, //                  non-blocked coach
      blockedCoach.email, //           blocked coach
      teamManager.email, //            attendee, non-coach role
      ed.email, //                     event director
      admin.email, //                  admin
    ];
    const { data, error } = await admin.client.rpc("promo_email_eligibility", {
      p_emails: inputs,
    });
    expect(error).toBeNull();
    const rows = data as { email: string; status: string }[];
    expect(rows.map((r) => [r.email, r.status])).toEqual([
      ["unknown-address@probe.test", "eligible"],
      [coach.email, "eligible"],
      [blockedCoach.email, "blocked"],
      [teamManager.email, "wrong-user-type"],
      [ed.email, "wrong-user-type"],
      [admin.email, "wrong-user-type"],
    ]);
    // (email, status) ONLY — no other account data crosses the bridge.
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["email", "status"]);
    }
  });

  it("matches case-insensitively and echoes the caller's own input", async () => {
    const shouted = coach.email.toUpperCase();
    const { data, error } = await ed.client.rpc("promo_email_eligibility", {
      p_emails: [shouted],
    });
    expect(error).toBeNull();
    expect(data).toEqual([{ email: shouted, status: "eligible" }]);
  });
});
