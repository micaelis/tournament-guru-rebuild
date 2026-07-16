import { test, expect } from "@playwright/test";
import { createAttendee, deleteUser, type SeededUser } from "./helpers/db";

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
  test("choosing a type reveals the role picker", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText("Pick your role")).toHaveCount(0);
    await page.getByRole("button", { name: /I'm looking for events/ }).click();
    await expect(page.getByText("Pick your role")).toBeVisible();
    await expect(page.getByText("Coach", { exact: true })).toBeVisible();
  });

  test("ED-claim deep link shows the Event Director hero copy", async ({
    page,
  }) => {
    await page.goto("/signup?type=event_director");
    await expect(
      page.getByText(/Become Part of the Largest/),
    ).toBeVisible();
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
