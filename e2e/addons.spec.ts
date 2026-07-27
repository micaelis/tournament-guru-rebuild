import { test, expect } from "@playwright/test";
import {
  createAdmin,
  createAttendee,
  createEventDirector,
  deleteEvent,
  deleteTournament,
  deleteUser,
  seedEvent,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Add-ons coming-soon preview E2E. The add-on feature is NOT live for
 * launch (payments deferred): the page must present Premium Listing /
 * General Ads as a preview with disabled "Coming soon" activation, the
 * ED Upgrade CTAs must route THERE (not to the admin premium confirm),
 * and the admin on-behalf confirm must keep working unchanged.
 */

test.describe("Add-ons — ED coming-soon preview", () => {
  test("row Upgrade routes to the preview; nothing is purchasable", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      seed = await seedEvent(ed.id, {
        lifecycle: "draft",
        title: "Addon Preview Probe",
      });
      await signIn(page, ed.email, ed.password);
      await page.goto("/dashboard/events");

      const upgrade = page.getByRole("button", { name: "Upgrade" });
      await expect(upgrade).toBeVisible();
      await upgrade.click();
      await expect(page).toHaveURL(
        new RegExp(`/dashboard/events/${seed.eventId}/add-ons`),
      );

      // Coming-soon framing is unmissable…
      await expect(
        page.getByRole("heading", { name: "Add-on Details" }),
      ).toBeVisible();
      await expect(
        page.getByText("Coming soon — add-ons aren't purchasable yet"),
      ).toBeVisible();
      // …and the Activate slot is a disabled stub, not a checkout.
      await expect(
        page.getByRole("button", { name: "Coming soon" }),
      ).toBeDisabled();
      // The rail shows which event the add-on would apply to (exact:
      // the back link also carries the title, prefixed with "Back to").
      await expect(
        page.getByText("Addon Preview Probe", { exact: true }),
      ).toBeVisible();

      // The General Ads tab swaps in the $300 rail — still disabled.
      await page.getByRole("tab", { name: /General Ads/ }).click();
      await expect(page.getByText("General Ads · one-time")).toBeVisible();
      await expect(
        page.getByText("Impression reporting included"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Coming soon" }),
      ).toBeDisabled();
    } finally {
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (ed) await deleteUser(ed.id);
    }
  });

  test("sidebar 'Learn more' lands on the event-less preview", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      await signIn(page, ed.email, ed.password);
      await page.goto("/dashboard/events");

      const learnMore = page.getByRole("link", { name: "Learn more" });
      await expect(learnMore).toBeVisible();
      await learnMore.click();
      await expect(page).toHaveURL(/\/dashboard\/add-ons/);
      await expect(
        page.getByRole("heading", { name: "Add-on Details" }),
      ).toBeVisible();
      // The pointer flips to its "You're here" state on the page itself.
      await expect(page.getByText("You're here")).toBeVisible();
    } finally {
      if (ed) await deleteUser(ed.id);
    }
  });

  test("attendee is bounced off the add-ons preview", async ({ page }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/add-ons");
      await expect(page).toHaveURL(/\/events/);
      await expect(
        page.getByRole("heading", { name: "Add-on Details" }),
      ).toHaveCount(0);
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});

test.describe("Add-ons — admin flow unchanged", () => {
  test("admin Upgrade still opens the on-behalf premium confirm", async ({
    page,
  }) => {
    let admin: SeededUser | undefined;
    let ed: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    try {
      admin = await createAdmin();
      ed = await createEventDirector({ completeOnboarding: true });
      seed = await seedEvent(ed.id, {
        lifecycle: "draft",
        title: "Admin Upgrade Probe",
      });
      await signIn(page, admin.email, admin.password);
      await page.goto(`/dashboard/events/${seed.eventId}`);

      await page
        .getByRole("button", { name: /Upgrade to premium/ })
        .click();
      // The confirm dialog — not a navigation to the preview page.
      await expect(
        page.getByText("Upgrade this event to premium?"),
      ).toBeVisible();
      await expect(page).toHaveURL(
        new RegExp(`/dashboard/events/${seed.eventId}$`),
      );
    } finally {
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (ed) await deleteUser(ed.id);
      if (admin) await deleteUser(admin.id);
    }
  });
});
