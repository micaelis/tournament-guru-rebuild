import { test, expect } from "@playwright/test";
import {
  createAttendee,
  createEventDirector,
  deleteUser,
  firstViewableEvent,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

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
