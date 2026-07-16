import { expect, type Page } from "@playwright/test";

/**
 * Sign in through the real login UI and wait until we've left /login.
 * Used by specs that need an authenticated session (onboarding, dashboard,
 * reviews). Seed the user first with the helpers in ./db.
 */
export async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
