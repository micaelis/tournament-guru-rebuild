import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { firstViewableEvent } from "./helpers/db";

/**
 * Automated accessibility scan of the key public pages. Fails on any
 * critical / serious WCAG 2.1 A/AA violation in first-party markup (the
 * Leaflet map is third-party and excluded).
 */
async function seriousViolations(page: Page) {
  // Let content settle + animations finish (the suite runs with reduced
  // motion, so the app's fade-ins complete instantly) before scanning —
  // otherwise axe can catch text mid-fade and report transient low contrast.
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".leaflet-container")
    .analyze();
  return results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
}

function summarize(violations: Awaited<ReturnType<typeof seriousViolations>>) {
  return JSON.stringify(
    violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target),
    })),
    null,
    2,
  );
}

test.describe("Accessibility (critical/serious)", () => {
  // Instant animations → axe scans the settled, final-state colors.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("login", async ({ page }) => {
    await page.goto("/login");
    const v = await seriousViolations(page);
    expect(v, summarize(v)).toEqual([]);
  });

  test("home", async ({ page }) => {
    await page.goto("/");
    const v = await seriousViolations(page);
    expect(v, summarize(v)).toEqual([]);
  });

  test("signup", async ({ page }) => {
    await page.goto("/signup");
    const v = await seriousViolations(page);
    expect(v, summarize(v)).toEqual([]);
  });

  test("find events", async ({ page }) => {
    await page.goto("/events");
    const v = await seriousViolations(page);
    expect(v, summarize(v)).toEqual([]);
  });

  test("event detail", async ({ page }) => {
    const ev = await firstViewableEvent();
    await page.goto(`/events/${ev.id}`);
    const v = await seriousViolations(page);
    expect(v, summarize(v)).toEqual([]);
  });
});
