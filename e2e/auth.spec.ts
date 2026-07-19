import { test, expect } from "@playwright/test";
import {
  createAttendee,
  deleteUser,
  deleteUserByEmail,
  type SeededUser,
} from "./helpers/db";

/**
 * Click-through E2E for the redesigned auth screens. Covers the shell/chrome,
 * cross-screen navigation, server-side validation, and the two real sign-in
 * outcomes (onboarding-incomplete vs complete). Runs against the local
 * Supabase stack via the webServer overrides in playwright.config.ts.
 */

test.describe("Auth shell — chrome", () => {
  test("login renders the redesigned split-hero shell", async ({ page }) => {
    await page.goto("/login");

    // Left column: eyebrow + heading + form
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    // Logo lives in the content (auth-mode header drops it)
    await expect(page.getByRole("img", { name: "Tournament Guru" })).toBeVisible();

    // Auth-mode header shows "Browse events" instead of a Sign-in CTA
    await expect(
      page.getByRole("link", { name: "Browse events" }),
    ).toBeVisible();

    // Right hero: badge + headline copy
    await expect(
      page.getByRole("heading", { name: /Welcome to\s+Tournament Guru/ }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "The most comprehensive youth sports tournament search engine",
      ),
    ).toBeVisible();
  });

  test("the hero image is hidden on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    // The right panel is `hidden md:block`, so its photo drops out on phones.
    await expect(
      page.locator('img[alt*="stadium lights"]'),
    ).toBeHidden();
  });
});

test.describe("Auth shell — navigation", () => {
  test("login → create an account", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
  });

  test("login → forgot password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/reset/);
    await expect(
      page.getByRole("heading", { name: "Reset your password" }),
    ).toBeVisible();
  });

  test("Browse events pill leaves the auth flow", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Browse events" }).click();
    await expect(page).toHaveURL(/\/events/);
  });
});

test.describe("Signup", () => {
  test("verify-email screen renders standalone with next steps", async ({ page }) => {
    // The prod signup path (confirmations on) redirects here — a full
    // screen, not a banner above the emptied form (Round-2 #3).
    await page.goto("/signup/verify-email");
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();
    await expect(page.getByText("Your account was created")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "sign up again" })).toBeVisible();
  });

  test("default entry shows the mandatory attendee role dropdown, no type picker", async ({
    page,
  }) => {
    await page.goto("/signup");
    // The in-form type picker is gone — type comes from the entry point.
    await expect(page.getByText("Which side of Tournament Guru")).toHaveCount(0);
    const role = page.getByLabel(/Are you a coach, parent \/ spectator, team manager\?/);
    await expect(role).toBeVisible();
    await expect(role).toHaveJSProperty("required", true);
    await expect(
      role.locator("option", { hasText: "Parent / Spectator" }),
    ).toHaveCount(1);
    await role.selectOption("coach");
    await expect(role).toHaveValue("coach");
  });

  test("ED-claim deep link shows the ED hero copy and ED role dropdown", async ({
    page,
  }) => {
    await page.goto("/signup?type=event_director");
    await expect(
      page.getByText(/Become Part of the Largest/),
    ).toBeVisible();
    const role = page.getByLabel(/Are you an Event Director, Event Admin, or Club Director\?/);
    await expect(role).toBeVisible();
    await expect(
      role.locator("option", { hasText: "Club Director" }),
    ).toHaveCount(1);
  });

  test("terms checkbox is required and links open the legal pages in a new tab", async ({
    page,
  }) => {
    await page.goto("/signup");
    const agree = page.getByRole("checkbox", {
      name: /I agree to the Privacy Policy and Legal Terms/,
    });
    await expect(agree).toBeAttached();
    await expect(agree).toHaveJSProperty("required", true);
    for (const [label, href] of [
      ["Privacy Policy", "/privacy"],
      ["Legal Terms", "/terms"],
    ] as const) {
      const link = page.getByRole("link", { name: label, exact: true });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
    }
  });

  test("signup with the box checked creates the account (local: straight to onboarding)", async ({
    page,
  }) => {
    const email = `e2e-signup-${Date.now()}@local.test`;
    try {
      await page.goto("/signup");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill("TgTest123");
      await page
        .getByLabel(/Are you a coach, parent \/ spectator, team manager\?/)
        .selectOption("coach");
      // The real input is sr-only behind the styled box — force past the
      // visibility actionability check (same idiom as the radio chips).
      await page
        .getByRole("checkbox", { name: /I agree to the Privacy Policy/ })
        .check({ force: true });
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("unchecked terms box is rejected by the SERVER and typed values survive", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("Email", { exact: true }).fill("keeps-values@example.com");
    await page.getByLabel("Password", { exact: true }).fill("TgTest123");
    await page
      .getByLabel(/Are you a coach, parent \/ spectator, team manager\?/)
      .selectOption("team_manager");
    // Strip the client-side gate to prove the server enforces the rule
    // (the client `required` is UX only).
    await page.evaluate(() => {
      document
        .querySelector('input[name="agree_terms"]')
        ?.removeAttribute("required");
    });
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByText(
        "Please agree to the Privacy Policy and Legal Terms to continue.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
    // Failed submit keeps what the user typed.
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "keeps-values@example.com",
    );
    await expect(
      page.getByLabel(/Are you a coach, parent \/ spectator, team manager\?/),
    ).toHaveValue("team_manager");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
      "TgTest123",
    );
  });
});

test.describe("Password reset", () => {
  test("returns the generic anti-enumeration message", async ({ page }) => {
    await page.goto("/reset");
    await page.getByLabel("Email", { exact: true }).fill("someone@example.com");
    await page.getByRole("button", { name: /Send reset link/ }).click();
    await expect(
      page.getByText(/If an account exists for that email/),
    ).toBeVisible();
  });
});

test.describe("Login outcomes", () => {
  test("wrong credentials show the incorrect-login error", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill(`nobody-${Date.now()}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("Wrongpass123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("Email or password is incorrect."),
    ).toBeVisible();
  });

  test("valid login, onboarding incomplete → /onboarding", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee();
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(user.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/onboarding/);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("valid login, onboarding complete → /events", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(user.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/events/);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});
