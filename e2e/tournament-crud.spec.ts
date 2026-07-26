import { test, expect } from "@playwright/test";
import {
  createAdmin,
  createEventDirector,
  deleteEvent,
  deleteTournament,
  deleteTournamentByTitle,
  deleteUser,
  getEventFields,
  seedCompleteEvent,
  seedEvent,
  seedTournament,
  seedUnclaimedTournament,
  tournamentExists,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Tournament + event CRUD journeys through the real UI.
 *
 * The EDIT path is the point of this spec. `saveEvent` wrote the base row
 * with a single `upsert`, which PostgREST compiles to ON CONFLICT DO
 * UPDATE with `id` in the SET list — and `id` carries no UPDATE grant, so
 * Postgres denied it. Creating an event worked (no `id` in the payload),
 * so the gap hid: every EDIT and every publish-a-draft failed for every
 * ED in production. It shipped because this path had no browser coverage
 * (S9.2). These journeys click it end to end and read the row back.
 *
 * Creating a NEW event (draft + publish) is already covered in
 * mutations.spec.ts and is not duplicated here.
 */

test.describe("Event director — tournament lifecycle", () => {
  test("creates a tournament through the dialog and sees it listed", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let existing: string | undefined;
    const title = `Created Cup ${Date.now()}`;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      // A pre-existing tournament puts the page past the first-run welcome
      // card, so the toolbar's "+ New tournament" is the control on screen.
      existing = await seedTournament(ed.id);
      await signIn(page, ed.email, ed.password);
      await page.goto("/dashboard/events");

      await page.getByRole("button", { name: "+ New tournament" }).click();
      await expect(
        page.getByRole("heading", { name: "Add tournament" }),
      ).toBeVisible();
      await page.getByLabel("Tournament title").fill(title);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Add tournament" })
        .click();

      await expect(page.getByText(title)).toBeVisible();
    } finally {
      // The dialog hands no id back to the test, so clean up by title.
      await deleteTournamentByTitle(title);
      if (existing) await deleteTournament(existing);
      if (ed) await deleteUser(ed.id);
    }
  });

  test("edits an existing published event and the change persists", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      seed = await seedCompleteEvent(ed.id, { title: "Before Edit" });
      await signIn(page, ed.email, ed.password);
      await page.goto(`/dashboard/events/${seed.eventId}/edit`);

      const newTitle = `After Edit ${Date.now()}`;
      await page.locator('input[name="title"]').fill(newTitle);
      await page.getByRole("button", { name: "Update", exact: true }).click();

      // Success redirects to the event details page with a FlashToast
      // (S12.16) — edits no longer stay parked on the form.
      await expect(page).toHaveURL(
        new RegExp(`/dashboard/events/${seed.eventId}`),
      );
      await expect(page.getByText("Changes saved")).toBeVisible();

      // Read the row back — the toast alone would not have caught S9.2,
      // where the write was denied but the UI still moved on.
      const row = await getEventFields(seed.eventId, "title, lifecycle");
      expect(row.title).toBe(newTitle);
      expect(row.lifecycle).toBe("active");
    } finally {
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (ed) await deleteUser(ed.id);
    }
  });

  test("publishes an existing draft and lifecycle flips to active", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      seed = await seedEvent(ed.id, {
        lifecycle: "draft",
        title: "Draft Awaiting Publish",
      });
      await signIn(page, ed.email, ed.password);
      await page.goto(`/dashboard/events/${seed.eventId}/edit`);

      // Publish enforces the full mandatory set, so fill what the seed omits.
      await page
        .locator('input[name="logo_url"]')
        .fill("https://example.com/logo.png");
      await page
        .locator('input[name="website_url"]')
        .fill("https://example.com");
      await page.locator('input[name="host_club"]').fill("Gateway SC");
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

      await page
        .getByRole("button", { name: "Update & publish", exact: true })
        .click();

      await expect(page).toHaveURL(
        new RegExp(`/dashboard/events/${seed.eventId}`),
      );
      await expect(page.getByText("Event published")).toBeVisible();
      const row = await getEventFields(seed.eventId, "lifecycle");
      expect(row.lifecycle).toBe("active");
    } finally {
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (ed) await deleteUser(ed.id);
    }
  });

  test("an emptied title is rejected on edit and the row is untouched", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      seed = await seedCompleteEvent(ed.id, { title: "Keep This Title" });
      await signIn(page, ed.email, ed.password);
      await page.goto(`/dashboard/events/${seed.eventId}/edit`);

      await page.locator('input[name="title"]').fill("");

      // Title is mandatory, so the primary submit disables itself — the
      // edit can't even be attempted with an empty title (client gate).
      await expect(
        page.getByRole("button", { name: "Update", exact: true }),
      ).toBeDisabled();

      // And the server is authoritative regardless: the row is untouched.
      const row = await getEventFields(seed.eventId, "title");
      expect(row.title).toBe("Keep This Title");
    } finally {
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (ed) await deleteUser(ed.id);
    }
  });

  test("deletes a tournament through the confirm dialog", async ({ page }) => {
    let ed: SeededUser | undefined;
    let tournamentId: string | undefined;
    const title = `Deletable Cup ${Date.now()}`;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      tournamentId = await seedTournament(ed.id, { title });
      await signIn(page, ed.email, ed.password);
      await page.goto("/dashboard/events");

      await page.getByRole("button", { name: `Delete ${title}` }).click();
      await expect(
        page.getByRole("button", { name: "Delete tournament" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Delete tournament" }).click();

      await expect(page.getByText("Tournament deleted.")).toBeVisible();
      expect(await tournamentExists(tournamentId)).toBe(false);
      tournamentId = undefined;
    } finally {
      if (tournamentId) await deleteTournament(tournamentId);
      if (ed) await deleteUser(ed.id);
    }
  });
});

test.describe("Admin — tournament management affordances (S1.1)", () => {
  test("offers no Edit on a tournament an ED has claimed", async ({ page }) => {
    let admin: SeededUser | undefined;
    let ed: SeededUser | undefined;
    let claimedId: string | undefined;
    let unclaimedId: string | undefined;
    // Unique per-run titles, and deliberately NOT substrings of each other,
    // so text/name matching can't confuse the two cards. The admin's list
    // shows every tournament, so a shared prefix would also collide with
    // rows other tests / seed data leave behind.
    const nonce = Date.now();
    const edHeldTitle = `EDHeld Cup ${nonce}`;
    const adminOpenTitle = `AdminOpen Cup ${nonce}`;
    try {
      admin = await createAdmin();
      ed = await createEventDirector({ completeOnboarding: true });
      claimedId = await seedTournament(ed.id, { title: edHeldTitle }); // claimed
      unclaimedId = await seedUnclaimedTournament(admin.id, {
        title: adminOpenTitle,
      });

      await signIn(page, admin.email, admin.password);
      await page.goto("/dashboard/events");

      // The ED-claimed card is still listed for the admin...
      await expect(
        page.getByRole("heading", { name: edHeldTitle, exact: true }),
      ).toBeVisible();
      // ...and the unclaimed one the admin created is manageable.
      await expect(
        page.getByRole("button", { name: `Delete ${adminOpenTitle}` }),
      ).toBeVisible();
      // But the ED-claimed one exposes no Delete (spec: admin manages a
      // tournament only while it is unclaimed).
      await expect(
        page.getByRole("button", { name: `Delete ${edHeldTitle}` }),
      ).toHaveCount(0);
    } finally {
      if (claimedId) await deleteTournament(claimedId);
      if (unclaimedId) await deleteTournament(unclaimedId);
      if (ed) await deleteUser(ed.id);
      if (admin) await deleteUser(admin.id);
    }
  });
});
