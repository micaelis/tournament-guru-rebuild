/**
 * #7 — the email-change confirmation flow must land on the dedicated
 * /email-change screen for every leg, never dump GoTrue's raw
 * "?message=Confirmation+link+accepted…" onto the homepage.
 *
 * Two units under test, both with the Supabase client mocked:
 *   - /auth/callback GET routing (secure email change: first click =
 *     message only, second click = code; expired links = error_* params;
 *     cross-device second click = PKCE verifier missing on exchange)
 *   - the updateEmail action (validation + emailRedirectTo contract that
 *     ties the mailed links to the callback → /email-change route)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ctl = vi.hoisted(() => ({
  exchangeError: null as null | { code?: string; message: string },
  user: null as null | { id: string; email?: string },
  profile: null as null | { onboarding_completed: boolean; user_type: string },
  exchangedCodes: [] as string[],
  updateUserArgs: null as null | unknown[],
  updateUserError: null as null | { message: string },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => {
        ctl.exchangedCodes.push(code);
        return { error: ctl.exchangeError };
      },
      getUser: async () => ({ data: { user: ctl.user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: ctl.profile }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerAuthClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: ctl.user } }),
      updateUser: async (...args: unknown[]) => {
        ctl.updateUserArgs = args;
        return { error: ctl.updateUserError };
      },
    },
  }),
}));

vi.mock("@/lib/site-url", () => ({
  siteUrl: async () => "http://localhost:3000",
}));

import { GET } from "@/app/auth/callback/route";
import { updateEmail } from "@/app/dashboard/account/actions";

async function callbackDest(qs: string): Promise<string> {
  const res = await GET(
    new NextRequest(`http://localhost:3000/auth/callback${qs}`),
  );
  return res.headers.get("location") ?? "";
}

beforeEach(() => {
  ctl.exchangeError = null;
  ctl.user = null;
  ctl.profile = null;
  ctl.exchangedCodes = [];
  ctl.updateUserArgs = null;
  ctl.updateUserError = null;
});

describe("/auth/callback email-change routing", () => {
  it("routes the FIRST confirmation click (message, no code) to the partial screen", async () => {
    const dest = await callbackDest(
      "?next=/email-change&message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email",
    );
    expect(dest).toBe("http://localhost:3000/email-change?stage=partial");
    expect(ctl.exchangedCodes).toHaveLength(0);
  });

  it("routes an expired/invalid link (error params, no code) to the error screen", async () => {
    const dest = await callbackDest(
      "?next=/email-change&error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(dest).toBe("http://localhost:3000/email-change?stage=error");
  });

  it("routes the SECOND click (code exchange succeeds) to the done screen", async () => {
    ctl.user = { id: "u1", email: "new@example.test" };
    const dest = await callbackDest("?next=/email-change&code=abc123");
    expect(dest).toBe("http://localhost:3000/email-change");
    expect(ctl.exchangedCodes).toEqual(["abc123"]);
  });

  it("treats a missing PKCE verifier (link opened on another device) as done-but-signed-out, not an error", async () => {
    ctl.exchangeError = {
      code: "pkce_code_verifier_not_found",
      message: "PKCE code verifier not found in storage.",
    };
    const dest = await callbackDest("?next=/email-change&code=abc123");
    expect(dest).toBe("http://localhost:3000/email-change");
  });

  it("routes any other exchange failure to the error screen", async () => {
    ctl.exchangeError = { code: "validation_failed", message: "bad code" };
    const dest = await callbackDest("?next=/email-change&code=abc123");
    expect(dest).toBe("http://localhost:3000/email-change?stage=error");
  });

  // Regression: non-email-change legs keep their existing behavior.
  it("still bounces a bare code-less hit to /login?error=callback", async () => {
    const dest = await callbackDest("");
    expect(dest).toBe("http://localhost:3000/login?error=callback");
  });

  it("still routes an onboarded attendee (no next) to /events after exchange", async () => {
    ctl.user = { id: "u1" };
    ctl.profile = { onboarding_completed: true, user_type: "attendee" };
    const dest = await callbackDest("?code=abc123");
    expect(dest).toBe("http://localhost:3000/events");
  });

  it("still routes an un-onboarded user (no next) to /onboarding after exchange", async () => {
    ctl.user = { id: "u1" };
    ctl.profile = { onboarding_completed: false, user_type: "attendee" };
    const dest = await callbackDest("?code=abc123");
    expect(dest).toBe("http://localhost:3000/onboarding");
  });
});

describe("/auth/callback next-param hardening (open redirect)", () => {
  // WHATWG URL parsing treats "\" as "/" for http(s), so all of these
  // resolve OFF-ORIGIN when fed to new URL(next, origin) — including the
  // backslash forms, which pass a naive startsWith("/") && !"//" guard.
  const HOSTILE_NEXT = [
    "/\\evil.com",
    "/\\/evil.com",
    "//evil.com",
    "https://evil.com",
  ];

  function qs(params: Record<string, string>): string {
    return `?${new URLSearchParams(params).toString()}`;
  }

  for (const next of HOSTILE_NEXT) {
    it(`ignores hostile next=${JSON.stringify(next)} and stays on-origin`, async () => {
      // Attacker pairs their own valid code with a hostile next: the
      // exchange succeeds, but next must fall back to "/" role routing.
      ctl.user = { id: "u1" };
      ctl.profile = { onboarding_completed: true, user_type: "attendee" };
      const dest = await callbackDest(qs({ next, code: "abc123" }));
      expect(dest).toBe("http://localhost:3000/events");
      expect(new URL(dest).origin).toBe("http://localhost:3000");
    });
  }

  it("ignores a hostile next on the code-less leg too", async () => {
    const dest = await callbackDest(
      qs({ next: "//evil.com", message: "Confirmation link accepted" }),
    );
    expect(dest).toBe("http://localhost:3000/login?error=callback");
  });

  it("still honors the allow-listed reset leg (next=/reset/update)", async () => {
    ctl.user = { id: "u1" };
    const dest = await callbackDest(qs({ next: "/reset/update", code: "abc123" }));
    expect(dest).toBe("http://localhost:3000/reset/update");
  });
});

describe("updateEmail action", () => {
  function form(email: string): FormData {
    const fd = new FormData();
    fd.set("email", email);
    return fd;
  }

  beforeEach(() => {
    ctl.user = { id: "u1", email: "old@example.test" };
  });

  it("rejects an invalid email without calling Supabase", async () => {
    const state = await updateEmail({}, form("not-an-email"));
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(ctl.updateUserArgs).toBeNull();
  });

  it("rejects the caller's current email (case-insensitively)", async () => {
    const state = await updateEmail({}, form("OLD@example.test"));
    expect(state.fieldErrors?.email).toBe("That's already your sign-in email.");
    expect(ctl.updateUserArgs).toBeNull();
  });

  it("sends the change with emailRedirectTo pointed at the email-change callback leg", async () => {
    const state = await updateEmail({}, form("new@example.test"));
    expect(state.info).toMatch(/both your current and your new inbox/);
    expect(ctl.updateUserArgs).toEqual([
      { email: "new@example.test" },
      { emailRedirectTo: "http://localhost:3000/auth/callback?next=/email-change" },
    ]);
  });

  it("surfaces a Supabase error to the form", async () => {
    ctl.updateUserError = { message: "email rate limit exceeded" };
    const state = await updateEmail({}, form("new@example.test"));
    expect(state.error).toBe("email rate limit exceeded");
  });
});
