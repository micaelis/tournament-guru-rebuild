import { test, expect } from "@playwright/test";
import { createAttendee, deleteUser, type SeededUser } from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Search-card Favorite heart, now wired to toggleFavorite. Anonymous visitors
 * get a sign-in nudge; a signed-in attendee's favorite persists and shows up
 * on their dashboard favorites.
 */

test.describe("Favorite events", () => {
  test("anonymous visitor is nudged to sign in", async ({ page }) => {
    await page.goto("/events");
    await page.getByRole("button", { name: "Save event" }).first().click();
    await expect(
      page.getByText("Sign in to favorite events."),
    ).toBeVisible();
  });

  test("signed-in attendee favorites an event → it shows in the dashboard", async ({
    page,
  }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/events");

      const heart = page.getByRole("button", { name: "Save event" }).first();
      // Wait for the toggleFavorite server action (a POST) to commit.
      await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === "POST" && r.status() < 400,
        ),
        heart.click(),
      ]);
      // Optimistic state flipped.
      await expect(
        page.getByRole("button", { name: "Remove from favorites" }).first(),
      ).toBeVisible();

      await page.goto("/dashboard/favorites");
      await expect(
        page.getByRole("heading", { name: "Favorites", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("No favorites yet")).toHaveCount(0);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});
