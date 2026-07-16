import { test, expect } from "@playwright/test";
import {
  createAttendee,
  createEventDirector,
  deleteUser,
  firstViewableEvent,
  seedPromo,
  deletePromo,
  type SeededUser,
  type PromoSeed,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

const RATING_CATEGORIES = [
  "Fields",
  "Facilities",
  "Tournament management",
  "Competition",
  "Diversity / variety",
  "Cost / value",
];

/**
 * Review-write access gating on /events/[id]/review. Only a signed-in,
 * onboarded attendee may reach the form; anon is sent to login and an event
 * director is bounced back to the event with an attendees-only notice.
 */

test.describe("Review write — access", () => {
  test("anonymous visitor is sent to login", async ({ page }) => {
    const ev = await firstViewableEvent();
    await page.goto(`/events/${ev.id}/review`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("event director is bounced with attendees-only", async ({ page }) => {
    const ev = await firstViewableEvent();
    let user: SeededUser | undefined;
    try {
      user = await createEventDirector({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto(`/events/${ev.id}/review`);
      await expect(page).toHaveURL(
        new RegExp(`/events/${ev.id}(\\?|$)`),
      );
      await expect(page).toHaveURL(/msg=attendees-only/);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("attendee reaches the write-a-review form", async ({ page }) => {
    const ev = await firstViewableEvent();
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto(`/events/${ev.id}/review`);
      await expect(
        page.getByRole("heading", { name: "Write a review" }),
      ).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});

test.describe("Review write — publish (verified via promo)", () => {
  test("coach fills ratings + copy, publishes, review shows the Guru badge", async ({
    page,
  }) => {
    let coach: SeededUser | undefined;
    let promo: PromoSeed | undefined;
    try {
      coach = await createAttendee({ completeOnboarding: true });
      promo = await seedPromo(coach.email);

      await signIn(page, coach.email, coach.password);
      // Promo landing claims the code and routes to the write-review page.
      await page.goto(`/promo/${promo.token}`);
      await expect(page).toHaveURL(
        new RegExp(`/events/${promo.eventId}/review`),
      );

      // Six category ratings via the now-accessible star buttons.
      for (const label of RATING_CATEGORIES) {
        await page
          .getByRole("radio", { name: `Rate ${label} 4 stars` })
          .click();
      }

      const title = `E2E verified review ${Date.now()}`;
      await page.getByLabel("Review title").fill(title);
      // The body's <label> also wraps the char counter, so match by name.
      await page
        .locator('textarea[name="review_body"]')
        .fill("Well-run event, great fields and strong competition. Would return.");
      // Coaches get the would-return prompt.
      await page.getByRole("button", { name: "Yes", exact: true }).click();

      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await page
        .getByRole("button", { name: "Confirm & Publish Review" })
        .click();

      // Redirects to the event page where the published review renders.
      await expect(page).toHaveURL(
        new RegExp(`/events/${promo.eventId}(\\?|$)`),
      );
      await expect(page.getByText(title)).toBeVisible();
      await expect(page.getByText("Guru Review")).toBeVisible();
    } finally {
      if (promo) await deletePromo(promo);
      if (coach) await deleteUser(coach.id);
    }
  });
});
