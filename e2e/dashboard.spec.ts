import { test, expect } from "@playwright/test";
import {
  createAttendee,
  createEventDirector,
  createAdmin,
  deleteUser,
  seedTournament,
  deleteTournament,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Dashboard E2E — role routing and the client-visible half of the access
 * model. RLS is the real boundary (covered by the Vitest probes); these check
 * the UX gates: where each role lands and that a wrong-role page bounces.
 */

test.describe("Dashboard — auth gate", () => {
  test("unauthenticated visitor is redirected to login", async ({ page }) => {
    await page.goto("/dashboard/events");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Dashboard — attendee", () => {
  test("lands on reviews and can open favorites", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard\/reviews/);

      await page.goto("/dashboard/favorites");
      await expect(
        page.getByRole("heading", { name: "Favorites", exact: true }),
      ).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("is bounced away from the admin users page", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/users");
      await expect(page).toHaveURL(/\/dashboard\/events/);
      await expect(
        page.getByRole("heading", { name: "Users" }),
      ).toHaveCount(0);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});

test.describe("Dashboard — event director", () => {
  test("lands on their events dashboard", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createEventDirector({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard\/events/);
      await expect(
        page.getByRole("heading", { name: "Your events" }),
      ).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("renders an owned tournament card without crashing", async ({ page }) => {
    // Regression guard: the events page passed a function prop to the client
    // TournamentCard, which threw once an ED actually owned a tournament.
    let user: SeededUser | undefined;
    let tournamentId: string | undefined;
    try {
      user = await createEventDirector({ completeOnboarding: true });
      tournamentId = await seedTournament(user.id);
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/events");
      await expect(
        page.getByRole("heading", { name: /E2E Cup/ }),
      ).toBeVisible();
    } finally {
      if (tournamentId) await deleteTournament(tournamentId);
      if (user) await deleteUser(user.id);
    }
  });
});

test.describe("Dashboard — admin", () => {
  test("can open the users moderation page", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAdmin();
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/users");
      await expect(page).toHaveURL(/\/dashboard\/users/);
      await expect(
        page.getByRole("heading", { name: "Users" }),
      ).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});
