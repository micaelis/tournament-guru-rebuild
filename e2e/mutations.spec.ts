import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createAttendee,
  createAdmin,
  createEventDirector,
  deleteUser,
  seedTournament,
  deleteTournament,
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
});
