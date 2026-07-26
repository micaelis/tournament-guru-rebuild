import { test, expect } from "@playwright/test";
import {
  createAdmin,
  deleteUser,
  getProfileFields,
  setProfileFields,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * The Account profile form renders different field sets per role: the
 * location autocomplete, gender radios and organization field are hidden
 * for admins, and the business-contact block renders only for EDs.
 *
 * `updateProfile` used to write every column unconditionally, so an
 * absent input became `"" -> null` and a routine "save my name" wiped
 * the hidden columns. This drives the real form and the real Server
 * Action, then reads the row back with the service role.
 */
test.describe("Account — partial profile save", () => {
  test("an admin saving their name keeps location, gender and organization", async ({
    page,
  }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAdmin();
      // Seed the columns the admin form does NOT render.
      await setProfileFields(user.id, {
        location_formatted: "Kansas City, MO",
        location_city: "Kansas City",
        location_state_abbr: "MO",
        user_gender: "female",
        organization_title: "Platform Ops",
      });

      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/account");
      await expect(
        page.getByRole("heading", { name: "Account", exact: true }),
      ).toBeVisible();

      // Sanity: these inputs really are absent for an admin, otherwise
      // this test would prove nothing.
      await expect(page.getByLabel("Location")).toHaveCount(0);

      await page.getByLabel("Last name").fill("RenamedByProbe");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Your profile has been saved.")).toBeVisible();

      const row = await getProfileFields(
        user.id,
        "last_name, location_formatted, location_city, location_state_abbr, user_gender, organization_title",
      );
      expect(row.last_name).toBe("RenamedByProbe");
      expect(row.location_formatted).toBe("Kansas City, MO");
      expect(row.location_city).toBe("Kansas City");
      expect(row.location_state_abbr).toBe("MO");
      expect(row.user_gender).toBe("female");
      expect(row.organization_title).toBe("Platform Ops");
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("an attendee clearing a rendered field still clears the column", async ({
    page,
  }) => {
    // The inverse guarantee: skipping absent fields must not make
    // deliberately-emptied fields un-clearable.
    let user: SeededUser | undefined;
    try {
      const { createAttendee } = await import("./helpers/db");
      user = await createAttendee({ completeOnboarding: true });
      await setProfileFields(user.id, { organization_title: "To Be Cleared" });

      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/account");
      const org = page.getByLabel("Club affiliation");
      await expect(org).toBeVisible();
      await org.fill("");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Your profile has been saved.")).toBeVisible();

      const row = await getProfileFields(user.id, "organization_title");
      expect(row.organization_title).toBeNull();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});
