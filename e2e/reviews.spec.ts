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
        new RegExp(`/events/${ev.id}`),
      );
      await expect(
        page.getByText("Only attendees can write reviews"),
      ).toBeVisible();
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

  test("a signed-in coach posts a comment on a review", async ({ page }) => {
    let author: SeededUser | undefined;
    let viewer: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    let reviewId: string | undefined;
    try {
      author = await createAttendee({ completeOnboarding: true });
      viewer = await createAttendee({ completeOnboarding: true });
      seed = await seedEvent(author.id);
      reviewId = await seedReview(
        seed.eventId,
        author.id,
        `E2E review ${Date.now()}`,
      );

      await signIn(page, viewer.email, viewer.password);
      await page.goto(`/events/${seed.eventId}`);
      await page.getByRole("button", { name: /Show comments/ }).click();

      const comment = `Great write-up, thanks! ${Date.now()}`;
      await page.getByPlaceholder("Write a comment…").fill(comment);
      await page.getByRole("button", { name: "Post comment" }).click();
      await expect(page.getByText(comment)).toBeVisible();
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

  test("a signed-in coach flags a review", async ({ page }) => {
    let author: SeededUser | undefined;
    let viewer: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    let reviewId: string | undefined;
    try {
      author = await createAttendee({ completeOnboarding: true });
      viewer = await createAttendee({ completeOnboarding: true });
      seed = await seedEvent(author.id);
      reviewId = await seedReview(
        seed.eventId,
        author.id,
        `E2E review ${Date.now()}`,
      );

      await signIn(page, viewer.email, viewer.password);
      await page.goto(`/events/${seed.eventId}`);
      await page.getByRole("button", { name: "Flag review" }).click();

      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Flag this review" }),
      ).toBeVisible();
      await dialog.getByRole("radio").first().check({ force: true });
      await dialog.getByRole("button", { name: "Confirm" }).click();

      await expect(
        page.getByText(/The admin will be notified about this review/),
      ).toBeVisible();
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

/**
 * Reviewer-details popup (spec §6.2, S2.7): clicking a reviewer's
 * username on the dashboard reviews table opens the two-pool popup.
 * Driven as the ED, which also exercises the identity fallback through
 * review_author_public (direct profile reads are admin-only): the
 * table cell + name search run on the public first name.
 */
test.describe("Dashboard reviews — reviewer details popup", () => {
  test("ED sees the reviewer's first name, searches by it, and opens the two rating pools", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let author: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    let reviewId: string | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      const firstName = `Zelda${Date.now()}`;
      author = await createAttendee({ completeOnboarding: true, firstName });
      const eventTitle = `E2E Popup Event ${Date.now()}`;
      seed = await seedEvent(ed.id, { title: eventTitle });
      reviewId = await seedReview(seed.eventId, author.id, "E2E popup review");

      await signIn(page, ed.email, ed.password);
      await page.goto("/dashboard/reviews");

      // The ED's profiles join is RLS-blanked; the table backfills from
      // review_author_public, so the real first name renders (never the
      // "Reviewer" placeholder) and name search matches it.
      const row = page.getByRole("row").filter({ hasText: eventTitle });
      await expect(row.getByRole("button", { name: firstName })).toBeVisible();

      const searchBox = page.getByRole("searchbox", { name: "Search reviews" });
      await searchBox.fill("no-such-reviewer-zzz");
      await expect(page.getByText("No reviews match your filters.")).toBeVisible();
      await searchBox.fill(firstName);
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: firstName }).click();

      const dialog = page.getByRole("dialog", { name: "Reviewer details" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText("Reviews as Verified Coach"),
      ).toBeVisible();
      await expect(dialog.getByText("Reviews as Attendee")).toBeVisible();
      // The seeded review is promo-less and published: the attendee
      // pool carries it, the coach pool is empty.
      await expect(dialog.getByText("1 review", { exact: true })).toBeVisible();
      await expect(dialog.getByText("0 reviews", { exact: true })).toBeVisible();
    } finally {
      if (reviewId) await deleteReview(reviewId);
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (ed) await deleteUser(ed.id);
      if (author) await deleteUser(author.id);
    }
  });
});

test.describe("My Reviews — location filter", () => {
  test("state chips show published counts and filter the list", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let author: SeededUser | undefined;
    const seeds: { eventId: string; tournamentId: string }[] = [];
    const reviewIds: string[] = [];
    const stamp = Date.now();
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      author = await createAttendee({ completeOnboarding: true });
      const mo = await seedEvent(ed.id, {
        title: `E2E MO Event ${stamp}`,
        state: "MO",
      });
      const il = await seedEvent(ed.id, {
        title: `E2E IL Event ${stamp}`,
        state: "IL",
      });
      seeds.push(mo, il);
      reviewIds.push(
        await seedReview(mo.eventId, author.id, `MO review ${stamp}`),
      );
      reviewIds.push(
        await seedReview(il.eventId, author.id, `IL review ${stamp}`),
      );

      await signIn(page, author.email, author.password);
      await page.goto("/dashboard/reviews");

      // One chip per state with this user's published-review count.
      const filterGroup = page.getByRole("group", {
        name: "Filter by location",
      });
      const moChip = filterGroup.getByRole("button", { name: /^MO/ });
      await expect(moChip).toContainText("1");
      await expect(
        filterGroup.getByRole("button", { name: /^IL/ }),
      ).toContainText("1");
      await expect(page.getByText(`MO review ${stamp}`)).toBeVisible();
      await expect(page.getByText(`IL review ${stamp}`)).toBeVisible();

      // Selecting a chip filters the list; toggling it off restores it.
      await moChip.click();
      await expect(page.getByText(`MO review ${stamp}`)).toBeVisible();
      await expect(page.getByText(`IL review ${stamp}`)).toBeHidden();
      await moChip.click();
      await expect(page.getByText(`IL review ${stamp}`)).toBeVisible();
    } finally {
      for (const id of reviewIds) await deleteReview(id);
      for (const s of seeds) {
        await deleteEvent(s.eventId);
        await deleteTournament(s.tournamentId);
      }
      if (author) await deleteUser(author.id);
      if (ed) await deleteUser(ed.id);
    }
  });
});
