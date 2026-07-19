import { test, expect } from "@playwright/test";
import {
  createAttendee,
  createEventDirector,
  deleteEvent,
  deleteTournament,
  deleteReview,
  deleteUser,
  firstViewableEvent,
  seedEvent,
  seedReview,
  type SeededUser,
} from "./helpers/db";

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

  test("wide list cards reflow coach + attendee ratings onto one row", async ({ page }) => {
    // Map visible: the results column is ~800px and featured cards
    // stack the two pools. Map hidden: cards span ~1230px and the
    // pools must share a row instead of stretching (Round-2 #13).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/events");
    const featured = page
      .locator("article.tg-event-card")
      .filter({ has: page.getByText("Coach", { exact: true }) })
      .first();
    const coach = featured.getByText("Coach", { exact: true });
    const attendee = featured.getByText("Attendee", { exact: true });
    const rowGap = async () => {
      const a = await coach.boundingBox();
      const b = await attendee.boundingBox();
      return a && b ? Math.abs(a.y - b.y) : Number.NaN;
    };
    await expect.poll(rowGap).toBeGreaterThan(10); // stacked beside the map
    // Two "Hide map" controls exist (text toggle in the controls bar + icon
    // button on the map overlay); target the text toggle unambiguously.
    await page.locator("button").filter({ hasText: "Hide map" }).click();
    await expect.poll(rowGap).toBeLessThan(8); // one row when wide
  });

  test("broken logo images unmount to their fallback, never the broken glyph", async ({ page }) => {
    // Kill every logo fetch up front so SafeImg's onError must swap each failed
    // <img> for its fallback — the browser's broken-image glyph must never
    // paint (Round-2 #11).
    await page.route("**images.unsplash.com/**", (route) => route.abort());
    await page.goto("/events");
    await expect(page.getByPlaceholder(/Search tournaments/)).toBeVisible();

    // Card logos are lazy-loaded, so an off-screen <img> never fetches and thus
    // never errors (correct behavior). Walk the page so every logo attempts its
    // now-aborted fetch and SafeImg drops it — otherwise the count is viewport-
    // and timing-dependent (flaky in CI).
    await page.evaluate(async () => {
      const step = 500;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });

    await expect
      .poll(async () => page.locator('img[src*="unsplash"]').count(), { timeout: 15000 })
      .toBe(0);
  });

  test("filter drawer lists States directly below Gender", async ({ page }) => {
    await page.goto("/events");
    await page.getByRole("button", { name: /All filters/ }).click();
    const labels = await page
      .getByRole("dialog", { name: "Filter tournaments" })
      .locator("div.text-\\[14px\\].font-bold")
      .allInnerTexts();
    const gender = labels.indexOf("Gender");
    expect(gender).toBeGreaterThan(-1);
    expect(labels[gender + 1]).toBe("States");
  });

  test("filter drawer distance box keeps focus across keystrokes", async ({ page }) => {
    // Each keystroke patches the filter state upstream; the drawer's
    // focus-on-open effect must not re-run on that re-render and steal
    // focus to the ✕ button (Round-2 #9).
    await page.goto("/events");
    await page.getByRole("button", { name: /All filters/ }).click();
    const box = page.getByRole("combobox", { name: "Your location" });
    await box.click();
    await box.pressSequentially("Kansas", { delay: 40 });
    await expect(box).toBeFocused();
    await expect(box).toHaveValue("Kansas");
  });

  test("event detail renders for a seeded event", async ({ page }) => {
    const ev = await firstViewableEvent();
    const resp = await page.goto(`/events/${ev.id}`);
    expect(resp?.status() ?? 200).toBeLessThan(400);
    await expect(page.getByText(ev.title).first()).toBeVisible();
  });

  test("host avatar renders through the shared Avatar primitive", async ({ page }) => {
    // Seeded event owned by a director WITH an org logo. The host
    // identity avatar must inherit the primitive's shape and fit —
    // circular with object-cover — not the old logo-only rounded-xl /
    // object-contain square that flipped shape on data presence.
    await page.goto("/events/22222222-0000-0000-0000-000000000001");
    const hostCard = page
      .locator("div", { has: page.getByText("Hosted by", { exact: true }) })
      .filter({ has: page.locator("img") })
      .last();
    const img = hostCard.locator("img").first();
    await expect(img).toHaveClass(/object-cover/);
    await expect(img).not.toHaveClass(/object-contain/);
    await expect(img.locator("xpath=..")).toHaveClass(/rounded-full/);
  });

  test("results show a Searching indicator while a fetch is in flight", async ({ page }) => {
    // Hold the search response so the loading state is deterministic.
    await page.route("**/api/events/search**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.goto("/events");
    await page.getByPlaceholder(/Search tournaments/).fill("soccer");
    await expect(page.getByText("Searching…")).toBeVisible();
    // Resolves back to results once the response lands.
    await expect(page.getByText("Searching…")).toBeHidden({ timeout: 10_000 });
  });

  test("filter drawer dates are masked mm/dd/yyyy (US, locale-independent)", async ({ page }) => {
    await page.goto("/events");
    await page.getByRole("button", { name: /All filters/ }).click();
    const from = page.getByLabel("From date");
    await expect(from).toHaveAttribute("placeholder", "mm/dd/yyyy");
    await from.pressSequentially("07041990");
    await expect(from).toHaveValue("07/04/1990");
    // A preset overwrites the box through the controlled ISO prop.
    await page.getByRole("button", { name: "This summer" }).click();
    await expect(from).toHaveValue(/06\/01\/\d{4}/);
  });

  test("sort-by select keeps its border-radius while focused", async ({ page }) => {
    // The global *:focus-visible rule must not overwrite an element's
    // own radius (border-radius: inherit squared the select against
    // its label wrapper while focused — Round-2 #12).
    await page.goto("/events");
    const select = page.locator("select").first();
    const radius = () =>
      select.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(await radius()).toBe("10px");
    await select.focus();
    await page.keyboard.press("ArrowDown"); // ensure :focus-visible heuristics engage
    expect(await radius()).toBe("10px");
  });

  test("contact submit keeps the confirmation in view", async ({ page }) => {
    // Submitting swaps the tall form for a short success card; the
    // viewport must land on the confirmation, not stay parked at the
    // bottom where the submit button was (Round-2 #1).
    // Sub-lg width stacks the pitch above the form, putting the form
    // deep in the page — the geometry where the post-submit swap
    // strands the viewport on the footer.
    await page.setViewportSize({ width: 768, height: 540 });
    await page.goto("/contact");
    await page.getByLabel(/Full Name/).fill("Probe Person");
    await page.getByLabel(/Email Address/).fill("probe@example.test");
    await page.getByLabel(/Additional Notes/).fill("Round-2 scroll check");
    // Reproduce the reporter's position: scrolled to the page bottom,
    // where the submit button lives on a short viewport.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole("button", { name: "Send Message" }).click();
    const heading = page.getByRole("heading", { name: "Message sent!" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
    // Engaged success state (Round-2 #2): reply-time expectation + next steps.
    await expect(page.getByText(/typically reply within/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse events while you wait" }),
    ).toBeVisible();
  });

  test("directors index renders", async ({ page }) => {
    await page.goto("/directors");
    await expect(
      page.getByRole("heading", { name: "Event Directors" }),
    ).toBeVisible();
  });

  test("public ED page: identity row, sortable events, reviews with comments module", async ({
    page,
  }) => {
    let ed: SeededUser | undefined;
    let reviewer: SeededUser | undefined;
    let seed: { tournamentId: string; eventId: string } | undefined;
    let reviewId: string | undefined;
    try {
      ed = await createEventDirector({ completeOnboarding: true });
      reviewer = await createAttendee({
        completeOnboarding: true,
        firstName: "Reviewer",
      });
      seed = await seedEvent(ed.id, { title: "ED Page Probe Event" });
      reviewId = await seedReview(seed.eventId, reviewer.id, "Great weekend");

      await page.goto(`/directors/${ed.id}`);

      // Header: org identity + the ED's own picture-and-name row (spec gap).
      await expect(
        page.getByRole("heading", { name: "Test Org" }),
      ).toBeVisible();
      await expect(page.getByText("Event Director", { exact: true })).toBeVisible();
      await expect(page.getByText("Test User", { exact: true })).toBeVisible();

      // Events tab: sort control defaults to publish date desc.
      const sort = page.getByLabel("Sort by");
      await expect(sort).toHaveValue("published");
      await expect(
        sort.locator("option", { hasText: "Highest rated" }),
      ).toHaveCount(1);
      await expect(page.getByText("ED Page Probe Event").first()).toBeVisible();

      // Reviews tab: summary columns (rating labels now appear in the
      // header AND the tab strip) + the shared review card with the
      // comments module affordance and the event-context chip.
      await page.getByRole("tab", { name: /Reviews/ }).click();
      await expect(page.getByText("Coach Rating")).toHaveCount(2);
      await expect(page.getByText("Attendee Rating")).toHaveCount(2);
      await expect(page.getByText("Great weekend")).toBeVisible();
      // The reviewer name is "Reviewer" today, "Reviewer U." once public
      // names carry the last initial.
      await expect(page.getByText(/^Reviewer(\sU\.)?$/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Show comments · 0/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /ED Page Probe Event/ }),
      ).toBeVisible();
    } finally {
      if (reviewId) await deleteReview(reviewId);
      if (seed) {
        await deleteEvent(seed.eventId);
        await deleteTournament(seed.tournamentId);
      }
      if (reviewer) await deleteUser(reviewer.id);
      if (ed) await deleteUser(ed.id);
    }
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

  test("privacy and legal pages render the provided copy", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What User Data We Collect" }),
    ).toBeVisible();
    await expect(page.getByText("Your IP address.")).toBeVisible();

    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Legal", level: 1, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Prohibited Use" }),
    ).toBeVisible();
    await expect(
      page.getByText("Use bots, crawlers, or other automated systems"),
    ).toBeVisible();
  });
});
