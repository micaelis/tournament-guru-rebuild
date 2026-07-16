import { test, expect } from "@playwright/test";
import {
  createAttendee,
  createEventDirector,
  deleteUser,
  firstViewableEvent,
  seedPromo,
  deletePromo,
  seedEvent,
  deleteEvent,
  deleteTournament,
  seedReview,
  deleteReview,
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

test.describe("Review interactions", () => {
  test("a signed-in coach marks another coach's review helpful", async ({
    page,
  }) => {
    let author: SeededUser | undefined;
    let viewer: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    let reviewId: string | undefined;
    try {
      author = await createAttendee({ completeOnboarding: true });
      viewer = await createAttendee({ completeOnboarding: true });
      seed = await seedEvent(author.id);
      const title = `E2E seeded review ${Date.now()}`;
      reviewId = await seedReview(seed.eventId, author.id, title);

      await signIn(page, viewer.email, viewer.password);
      await page.goto(`/events/${seed.eventId}`);
      await expect(page.getByText(title)).toBeVisible();

      const helpful = page.getByRole("button", { name: /Helpful/ });
      await expect(helpful).toHaveAttribute("aria-pressed", "false");
      await helpful.click();
      await expect(helpful).toHaveAttribute("aria-pressed", "true");
      await expect(helpful).toContainText("1");
    } finally {
      if (reviewId) await deleteReview(reviewId);
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (viewer) await deleteUser(viewer.id);
      if (author) await deleteUser(author.id);
    }
  });
});
