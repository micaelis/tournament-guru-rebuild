import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createAttendee,
  createAdmin,
  createEventDirector,
  deleteUser,
  seedTournament,
  deleteTournament,
  deleteEvent,
  deleteBannedWord,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Dashboard write flows with accessible controls: an attendee editing their
 * account, an admin adding a banned word, and an ED reaching the Add Event
 * form. (Review submission + the full EventForm are intentionally not driven
 * here — their controls are positional/very large; the RLS + validation
 * probes guard their logic.)
 */

test.describe("Account settings", () => {
  test("attendee edits their profile and sees it saved", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/account");
      await expect(
        page.getByRole("heading", { name: "Account", exact: true }),
      ).toBeVisible();

      await page.getByLabel("First name").fill("Renamed");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Profile updated.")).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});

test.describe("Admin — banned words", () => {
  test("adds a word and it appears in the list", async ({ page }) => {
    const word = `e2eword${randomUUID().slice(0, 8)}`;
    let admin: SeededUser | undefined;
    try {
      admin = await createAdmin();
      await signIn(page, admin.email, admin.password);
      await page.goto("/dashboard/banned-words");
      await expect(
        page.getByRole("heading", { name: "Banned Words" }),
      ).toBeVisible();

      await page.getByLabel("Word").fill(word);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText(word)).toBeVisible();
    } finally {
      await deleteBannedWord(word);
      if (admin) await deleteUser(admin.id);
    }
  });
});

test.describe("Admin — block a user", () => {
  test("searches for a user and blocks them", async ({ page }) => {
    const marker = `Blocktarget${randomUUID().slice(0, 8)}`;
    let admin: SeededUser | undefined;
    let target: SeededUser | undefined;
    try {
      admin = await createAdmin();
      target = await createAttendee({
        completeOnboarding: true,
        firstName: marker,
      });

      await signIn(page, admin.email, admin.password);
      await page.goto("/dashboard/users");

      // Find the target among all users via the new search.
      await page.getByLabel("Search users").fill(marker);
      await page.getByRole("button", { name: "Search" }).click();
      await expect(page.getByText(marker)).toBeVisible();

      // Row action → confirm dialog → block.
      await page.getByRole("button", { name: "Block", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Block this user?" }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Block" })
        .click();

      // Revalidated row shows the Blocked pill.
      await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
    } finally {
      if (target) await deleteUser(target.id);
      if (admin) await deleteUser(admin.id);
    }
  });
});

test.describe("Admin — delete a user", () => {
  test("searches for a user and deletes them", async ({ page }) => {
    const marker = `Deltarget${randomUUID().slice(0, 8)}`;
    let admin: SeededUser | undefined;
    let target: SeededUser | undefined;
    try {
      admin = await createAdmin();
      target = await createAttendee({
        completeOnboarding: true,
        firstName: marker,
      });

      await signIn(page, admin.email, admin.password);
      await page.goto("/dashboard/users");
      await page.getByLabel("Search users").fill(marker);
      await page.getByRole("button", { name: "Search" }).click();
      await expect(page.getByText(marker)).toBeVisible();

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Delete this user?" }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete" })
        .click();

      await expect(page.getByText("User deleted.")).toBeVisible();
    } finally {
      if (target) await deleteUser(target.id);
      if (admin) await deleteUser(admin.id);
    }
  });
});

test.describe("Event director — create event", () => {
  test("reaches the Add Event form for an owned tournament", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let tournamentId: string | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      tournamentId = await seedTournament(ed.id);
      await signIn(page, ed.email, ed.password);
      await page.goto(`/dashboard/events/new?tournament=${tournamentId}`);
      await expect(
        page.getByRole("heading", { name: "Add Event" }),
      ).toBeVisible();
    } finally {
      if (tournamentId) await deleteTournament(tournamentId);
      if (ed) await deleteUser(ed.id);
    }
  });

  test("submits the Add Event form as a draft", async ({ page }) => {
    let ed: SeededUser | undefined;
    let tournamentId: string | undefined;
    let createdEventId: string | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      tournamentId = await seedTournament(ed.id);
      await signIn(page, ed.email, ed.password);
      await page.goto(`/dashboard/events/new?tournament=${tournamentId}`);

      const title = `E2E Draft Event ${Date.now()}`;
      await page.locator('input[name="title"]').fill(title);
      // A draft only requires a title; saveEvent redirects to the event page.
      await page.getByRole("button", { name: "Save as draft" }).click();

      await expect(page).toHaveURL(
        /\/dashboard\/events\/[0-9a-f-]{36}/,
      );
      createdEventId = page.url().split("/").pop();
      await expect(page.getByText(title)).toBeVisible();
    } finally {
      if (createdEventId) await deleteEvent(createdEventId);
      if (tournamentId) await deleteTournament(tournamentId);
      if (ed) await deleteUser(ed.id);
    }
  });

  test("publishes an event with all required fields", async ({ page }) => {
    let ed: SeededUser | undefined;
    let tournamentId: string | undefined;
    let createdEventId: string | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      tournamentId = await seedTournament(ed.id);
      await signIn(page, ed.email, ed.password);
      await page.goto(`/dashboard/events/new?tournament=${tournamentId}`);

      const title = `E2E Published Event ${Date.now()}`;
      await page.locator('input[name="title"]').fill(title);
      await page
        .locator('input[name="logo_url"]')
        .fill("https://example.com/logo.png");
      await page
        .locator('input[name="website_url"]')
        .fill("https://example.com");
      await page.locator('input[name="host_club"]').fill("Gateway SC");
      await page.locator('input[name="start_date"]').fill("2026-08-01");
      await page.locator('input[name="end_date"]').fill("2026-08-02");
      await page
        .locator('textarea[name="description"]')
        .fill("A premier youth tournament with strong competition.");
      await page
        .locator('input[name="location_formatted"]')
        .fill("St. Louis, MO");
      await page.locator('select[name="region"]').selectOption("I");
      await page.locator('select[name="season_id"]').selectOption({ index: 1 });
      await page.getByRole("button", { name: "Upper", exact: true }).click();
      await page.getByRole("button", { name: "Grass", exact: true }).click();

      await page.getByRole("button", { name: "Publish", exact: true }).click();

      // Passing publish validation redirects to the event page.
      await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}/);
      createdEventId = page.url().split("/").pop();
      await expect(page.getByText(title)).toBeVisible();
    } finally {
      if (createdEventId) await deleteEvent(createdEventId);
      if (tournamentId) await deleteTournament(tournamentId);
      if (ed) await deleteUser(ed.id);
    }
  });
});
