import { test, expect, type Page } from "@playwright/test";
import {
  createAttendee,
  createEventDirector,
  deleteUser,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Onboarding wizard E2E. Drives the multi-step flow the way a real user does
 * — each "Continue" runs a Server Action that revalidates /onboarding and the
 * page re-renders at the next step. Attendees finish in 3 steps → /events;
 * Event Directors in 4 → /dashboard/events.
 */

async function completeStep1(page: Page, opts: { org: string }) {
  await expect(
    page.getByRole("heading", { name: "Personal Information" }),
  ).toBeVisible();
  await page.getByLabel("First name").fill("Casey");
  await page.getByLabel("Last name").fill("Rivera");
  // Role radio is pre-selected from signup metadata; org field varies by type.
  await page.getByLabel(/Organization title|Club affiliation/).fill(opts.org);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** DOB is a masked mm/dd/yyyy text input; the helper takes ISO and types US format. */
function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

async function completeStep2(page: Page, dob: string) {
  await expect(page.getByRole("heading", { name: "About You" })).toBeVisible();
  await page.getByLabel("Location").fill("St. Louis, MO");
  await page.getByRole("radio", { name: "Female" }).check({ force: true });
  const dobBox = page.getByLabel("Date of birth");
  await expect(dobBox).toHaveAttribute("placeholder", "mm/dd/yyyy");
  await dobBox.fill(usDate(dob));
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("Onboarding — attendee", () => {
  test("walks the 3-step wizard through to /events", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee();
      await signIn(page, user.email, user.password);
      await expect(page).toHaveURL(/\/onboarding/);

      await completeStep1(page, { org: "Rivera SC" });
      await completeStep2(page, "1990-06-15");

      // Step 3 — Preferred Event Criteria (all optional) → Finish.
      await expect(
        page.getByRole("heading", { name: "Preferred Event Criteria" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Finish" }).click();

      await expect(page).toHaveURL(/\/onboarding\/success/);
      await page.getByRole("link", { name: "Browse Events", exact: true }).click();
      await expect(page).toHaveURL(/\/events/);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("blocks an under-18 date of birth at step 2", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee();
      await signIn(page, user.email, user.password);
      await completeStep1(page, { org: "Rivera SC" });

      await expect(
        page.getByRole("heading", { name: "About You" }),
      ).toBeVisible();
      await page.getByLabel("Location").fill("St. Louis, MO");
      await page
        .getByRole("radio", { name: "Male", exact: true })
        .check({ force: true });
      await page.getByLabel("Date of birth").fill(usDate("2015-01-01"));
      await page.getByRole("button", { name: "Continue" }).click();

      await expect(
        page.getByText("You must be at least 18 to use Tournament Guru."),
      ).toBeVisible();
      // Still on step 2 — not advanced.
      await expect(
        page.getByRole("heading", { name: "About You" }),
      ).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("can sign out from the wizard back to /login", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee();
      await signIn(page, user.email, user.password);
      await expect(page).toHaveURL(/\/onboarding/);
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login/);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});

test.describe("Onboarding — event director", () => {
  test("walks the 4-step wizard through to the dashboard", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createEventDirector();
      await signIn(page, user.email, user.password);
      await expect(page).toHaveURL(/\/onboarding/);

      await completeStep1(page, { org: "Gateway Cup Org" });
      await completeStep2(page, "1985-03-20");

      // Step 3 — EDs get "Continue" (not "Finish") → step 4.
      await expect(
        page.getByRole("heading", { name: "Preferred Event Criteria" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();

      // Step 4 — Your Organization; description is required.
      await expect(
        page.getByRole("heading", { name: "Your Organization" }),
      ).toBeVisible();
      await page
        .getByLabel("Organization description")
        .fill("We run premier youth soccer tournaments across the Midwest.");
      await page.getByRole("button", { name: "Finish onboarding" }).click();

      await expect(page).toHaveURL(/\/onboarding\/success/);
      await page.getByRole("link", { name: "Go to Dashboard" }).click();
      await expect(page).toHaveURL(/\/dashboard\/events/);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});
