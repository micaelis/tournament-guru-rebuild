import { test, expect } from "@playwright/test";
import { firstViewableEvent } from "./helpers/db";

/**
 * Public discovery E2E — the un-authenticated marketing + search surfaces.
 * Home hero search, the Find Events page, an event detail page, the directors
 * index, and the static content routes.
 */

test.describe("Public discovery", () => {
  test("home hero renders and search routes to /events", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Welcome to\s+Tournament Guru/ }),
    ).toBeVisible();

    await page.getByPlaceholder("Search events by any keyword").fill("soccer");
    await page.getByRole("button", { name: "Find Events" }).click();
    await expect(page).toHaveURL(/\/events\?q=soccer/);
  });

  test("Find Events page renders the search + filter bar", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByPlaceholder(/Search tournaments/)).toBeVisible();
    await expect(page.getByRole("button", { name: /All filters/ })).toBeVisible();
  });

  test("event detail renders for a seeded event", async ({ page }) => {
    const ev = await firstViewableEvent();
    const resp = await page.goto(`/events/${ev.id}`);
    expect(resp?.status() ?? 200).toBeLessThan(400);
    await expect(page.getByText(ev.title).first()).toBeVisible();
  });

  test("directors index renders", async ({ page }) => {
    await page.goto("/directors");
    await expect(
      page.getByRole("heading", { name: "Event Directors" }),
    ).toBeVisible();
  });

  test("static content routes load with a heading", async ({ page }) => {
    const paths = [
      "/about",
      "/contact",
      "/faq",
      "/help",
      "/host",
      "/guides",
      "/travel",
      "/privacy",
      "/terms",
    ];
    for (const path of paths) {
      const resp = await page.goto(path);
      expect(resp?.status() ?? 200, `${path} status`).toBeLessThan(400);
      await expect(
        page.getByRole("heading").first(),
        `${path} heading`,
      ).toBeVisible();
    }
  });
});
