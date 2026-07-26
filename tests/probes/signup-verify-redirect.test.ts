/**
 * Round-2 #3 — after a successful signup the user LEAVES the signup
 * page:
 *   - confirmations on (no session yet) → /signup/verify-email
 *   - local dev (session returned)      → /onboarding
 *   - failed validation → field errors, NO redirect (values preserved
 *     client-side by useSubmittedValues)
 *   - already-registered email (Supabase's anti-enumeration shape: user
 *     with an EMPTY identities array, no session) → `email` field error
 *     + `code: "email_exists"`, NO redirect to verify-email (S12.4)
 *
 * Drives the real `signupAction` with the Supabase server client and
 * next/headers mocked; redirect() throws NEXT_REDIRECT with the
 * destination in the digest.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctl = vi.hoisted(() => ({
  session: null as object | null,
  // A genuine NEW signup carries the email identity; an existing email
  // comes back with [] — the guard keys on exactly that.
  identities: [{ id: "i1" }] as object[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerAuthClient: async () => ({
    auth: {
      signUp: async () => ({
        data: {
          session: ctl.session,
          user: { id: "u1", identities: ctl.identities },
        },
        error: null,
      }),
    },
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "http://localhost:3000" }),
}));

import { signupAction } from "@/app/(auth)/actions";

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("email", "probe@example.test");
  fd.set("password", "TgTest123");
  fd.set("user_type", "attendee");
  fd.set("role_title", "coach");
  fd.set("agree_terms", "yes");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

async function redirectDigest(fd: FormData): Promise<string> {
  try {
    await signupAction({}, fd);
  } catch (e) {
    return String((e as { digest?: string }).digest ?? "");
  }
  return "";
}

beforeEach(() => {
  ctl.session = null;
  ctl.identities = [{ id: "i1" }];
});

describe("signup post-create routing", () => {
  it("redirects to the standalone verify-email screen when no session returns", async () => {
    const digest = await redirectDigest(form());
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain("/signup/verify-email");
  });

  it("redirects straight to onboarding when a session returns (local dev)", async () => {
    ctl.session = { access_token: "t" };
    const digest = await redirectDigest(form());
    expect(digest).toContain("/onboarding");
  });

  it("returns field errors without redirecting on invalid input", async () => {
    const state = await signupAction({}, form({ email: "not-an-email" }));
    expect(state.fieldErrors?.email).toBeTruthy();
  });

  it("rejects signup server-side when the terms box is unchecked", async () => {
    // The client `required` is UX only — a stripped attribute must still
    // stop the account at the action.
    const fd = form();
    fd.delete("agree_terms");
    const state = await signupAction({}, fd);
    expect(state.fieldErrors?.agree_terms).toMatch(/Privacy Policy and Legal Terms/);
  });

  it("treats a tampered agree_terms value as not agreed", async () => {
    const state = await signupAction({}, form({ agree_terms: "maybe" }));
    expect(state.fieldErrors?.agree_terms).toBeTruthy();
  });

  // S12.4 — an already-registered email must be REVEALED, not routed to
  // the verify-email screen. Mutation check: removing the identities
  // guard in signupAction makes the action redirect (throw), failing
  // both assertions here.
  it("returns an email field error — and does NOT redirect — when the email is already registered", async () => {
    ctl.identities = []; // Supabase's existing-email shape (confirmations on)
    const state = await signupAction({}, form());
    expect(state.fieldErrors?.email).toBe(
      "An account with this email already exists. Try logging in, or reset your password.",
    );
    expect(state.code).toBe("email_exists");
  });

  it("still routes a genuine new signup (identities populated) to verify-email", async () => {
    const digest = await redirectDigest(form());
    expect(digest).toContain("/signup/verify-email");
  });
});
