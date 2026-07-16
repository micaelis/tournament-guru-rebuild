import { test, expect } from "@playwright/test";
import {
  createAttendee,
  deleteUser,
  seedPromo,
  deletePromo,
  type SeededUser,
  type PromoSeed,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Promo verified-review flow (the "2nd auth version"). The RPC logic is
 * covered by the C3/C4 Vitest probes; these drive the UI redirects:
 * bogus token → placeholder, anon valid token → prefilled signup, and a
 * matching signed-in coach → claim → the review-write page.
 */

test.describe("Promo landing", () => {
  test("an unknown token shows the inactive-link placeholder", async ({
    page,
  }) => {
    await page.goto("/promo/definitely-not-a-real-token");
    await expect(
      page.getByRole("heading", { name: "This link isn't active" }),
    ).toBeVisible();
    // Rendered inside the shared auth shell (right-panel hero present).
    await expect(
      page.getByRole("heading", { name: /Welcome to\s+Tournament Guru/ }),
    ).toBeVisible();
  });

  test("a valid token, anonymous → prefilled attendee signup", async ({
    page,
  }) => {
    let promo: PromoSeed | undefined;
    try {
      promo = await seedPromo(`coach-${Date.now()}@local.test`);
      await page.goto(`/promo/${promo.token}`);
      await expect(page).toHaveURL(/\/signup/);
      await expect(page).toHaveURL(/type=attendee/);
      await expect(page).toHaveURL(/role=coach/);
    } finally {
      if (promo) await deletePromo(promo);
    }
  });

  test("a matching signed-in coach claims → review-write page", async ({
    page,
  }) => {
    let coach: SeededUser | undefined;
    let promo: PromoSeed | undefined;
    try {
      coach = await createAttendee({ completeOnboarding: true });
      promo = await seedPromo(coach.email);

      await signIn(page, coach.email, coach.password);
      await page.goto(`/promo/${promo.token}`);

      await expect(page).toHaveURL(
        new RegExp(`/events/${promo.eventId}/review`),
      );
      await expect(
        page.getByRole("heading", { name: "Write a review" }),
      ).toBeVisible();
    } finally {
      if (promo) await deletePromo(promo);
      if (coach) await deleteUser(coach.id);
    }
  });
});
