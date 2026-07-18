/**
 * H-8 probe — the server is authoritative for the password rule.
 *
 * The client shows the strict policy (8 chars + uppercase + digit); the
 * account action previously enforced only `length >= 8` server-side, so
 * a crafted request could set "weakpass" — a password signup and reset
 * would both reject. The probe drives the REAL `updatePassword` server
 * action against real local auth and proves the weak password never
 * lands: sign-in with it still fails afterwards.
 *
 * Same class, same action file: `business_email` was stored with no
 * server-side validateEmail while signup/reset validate theirs.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anon, createUser, purge, service } from "../harness";

const ctl = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createServerAuthClient: async () => ctl.client as SupabaseClient,
  createAnonServerClient: () => {
    throw new Error("h8 probe: unexpected anon client use");
  },
}));

import { updatePassword, updateProfile } from "@/app/dashboard/account/actions";

const ORIGINAL_PASSWORD = "TgTest123";
let userId = "";
let email = "";
let client!: SupabaseClient;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeAll(async () => {
  const user = await createUser({ completeOnboarding: true, role: "coach" });
  userId = user.id;
  email = user.email;
  client = user.client;
  ctl.client = client;
});

afterAll(async () => {
  await purge([userId]);
});

describe("h8 · updatePassword enforces the full policy server-side", () => {
  it.each([
    ["too short", "Ab1"],
    ["no uppercase", "weakpass1"],
    ["no digit", "Weakpassword"],
  ])("rejects a password with %s and does NOT change auth", async (_label, weak) => {
    const res = await updatePassword({}, form({ password: weak }));
    expect(res.fieldErrors?.password).toBeTruthy();

    // Runtime proof: the weak password did not land...
    const weakSignIn = await anon().auth.signInWithPassword({ email, password: weak });
    expect(weakSignIn.error).not.toBeNull();
    // ...and the original still works.
    const okSignIn = await anon().auth.signInWithPassword({
      email,
      password: ORIGINAL_PASSWORD,
    });
    expect(okSignIn.error).toBeNull();
  });

  it("accepts a policy-conforming password and it becomes live", async () => {
    const res = await updatePassword({}, form({ password: "NewPass123" }));
    expect(res.fieldErrors).toBeUndefined();
    expect(res.info).toBeTruthy();

    const signIn = await anon().auth.signInWithPassword({
      email,
      password: "NewPass123",
    });
    expect(signIn.error).toBeNull();
  });
});

describe("h8 · updateProfile validates business_email server-side", () => {
  it("rejects a malformed business_email and writes nothing", async () => {
    const res = await updateProfile(
      {},
      form({
        first_name: "Probe",
        last_name: "User",
        business_email: "not-an-email",
      }),
    );
    expect(res.fieldErrors?.business_email).toBeTruthy();

    const { data } = await service()
      .from("profiles")
      .select("business_email, first_name")
      .eq("id", userId)
      .single();
    expect((data as { business_email: string | null }).business_email).toBeNull();
  });
});
