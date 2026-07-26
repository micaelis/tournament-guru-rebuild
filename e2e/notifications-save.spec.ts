import { test, expect } from "@playwright/test";
import {
  createAttendee,
  deleteUser,
  getProfileFields,
  setProfileFields,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * S12.10 — saving notification prefs used to snap the toggles back to
 * their page-load state: React's automatic post-action form reset
 * reverts checkbox DOM state to the page-load `checked` attribute (and
 * skips re-writing a controlled input whose state didn't change). This
 * drives the real form + Server Action against the button-backed
 * Switch and asserts all three layers: the DB row persisted `false`,
 * the on-screen switch stays unchecked right after the save, and a
 * fresh page load agrees.
 */
test.describe("Account — notification prefs save", () => {
  test("unchecking a switch persists false and the UI shows it unchecked", async ({
    page,
  }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await setProfileFields(user.id, {
        inapp_review_replies: true,
        email_review_replies: true,
      });

      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/account");
      await page.getByRole("tab", { name: "Notifications" }).click();

      const inApp = page.getByRole("switch", {
        name: "Review replies (in-app)",
      });
      await expect(inApp).toBeChecked();
      await inApp.click();
      await expect(inApp).not.toBeChecked();

      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(
        page.getByText("Notification preferences updated."),
      ).toBeVisible();

      // The regression: post-save the switch must show the SAVED state,
      // not the page-load default.
      await expect(inApp).not.toBeChecked();

      const row = await getProfileFields(
        user.id,
        "inapp_review_replies, email_review_replies",
      );
      expect(row.inapp_review_replies).toBe(false);
      // Its rendered-and-still-checked pair partner stays true.
      expect(row.email_review_replies).toBe(true);

      // A fresh render from the DB agrees with what the user saw.
      await page.reload();
      await page.getByRole("tab", { name: "Notifications" }).click();
      await expect(
        page.getByRole("switch", { name: "Review replies (in-app)" }),
      ).not.toBeChecked();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});
