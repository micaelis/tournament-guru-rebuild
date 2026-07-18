/**
 * Round-2 #3 — after a successful signup the user LEAVES the signup
 * page:
 *   - confirmations on (no session yet) → /signup/verify-email
 *   - local dev (session returned)      → /onboarding
 *   - failed validation → field errors, NO redirect (values preserved
 *     client-side by useSubmittedValues)
 *
 * Drives the real `signupAction` with the Supabase server client and
 * next/headers mocked; redirect() throws NEXT_REDIRECT with the
 * destination in the digest.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctl = vi.hoisted(() => ({
  session: null as object | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerAuthClient: async () => ({
    auth: {
      signUp: async () => ({
        data: { session: ctl.session, user: { id: "u1" } },
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
});
