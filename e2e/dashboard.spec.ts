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
      // Attendees cascade: /dashboard/users → /dashboard/events (non-admin)
      // → /events (attendee), landing on the public search page.
      await expect(page).toHaveURL(/\/events/);
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

  test("can find a user by email and reach the block/delete actions", async ({
    page,
  }) => {
    let admin: SeededUser | undefined;
    let target: SeededUser | undefined;
    try {
      admin = await createAdmin();
      // A distinctive first name pins the row assertion to THIS user.
      target = await createAttendee({
        completeOnboarding: true,
        firstName: "Needle",
      });
      await signIn(page, admin.email, admin.password);
      await page.goto("/dashboard/users");

      // Search by the seeded user's email — a term no profile column
      // carries, so a hit proves the auth.users email bridge.
      await page.getByLabel("Search users").fill(target.email);
      await page.getByRole("button", { name: "Search" }).click();

      const row = page.getByRole("row", { name: /Needle User/ });
      await expect(row).toBeVisible();
      await expect(row.getByRole("button", { name: "Block" })).toBeVisible();
      await expect(row.getByRole("button", { name: "Delete" })).toBeVisible();

      // The block flow is reachable from the filtered row: the confirm
      // dialog opens (moderation itself is covered by the RPC probes).
      await row.getByRole("button", { name: "Block" }).click();
      await expect(page.getByText("Block this user?")).toBeVisible();
    } finally {
      if (target) await deleteUser(target.id);
      if (admin) await deleteUser(admin.id);
    }
  });
});
