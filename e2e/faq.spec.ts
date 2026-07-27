import { test, expect } from "@playwright/test";
import {
  createAttendee,
  createEventDirector,
  deleteUser,
  type SeededUser,
} from "./helpers/db";
import { signIn } from "./helpers/auth";

/**
 * Dashboard FAQ page (S12.43): the elevated header's count chips derive
 * from the LIVE audience-filtered seed (5 published FAQs — attendee
 * sees 3, ED 4), search filters rows live (matches auto-expand, empty
 * topics hide, zero results → the shared EmptyState), and the Guru
 * explainer ships pre-expanded.
 */
test.describe("Dashboard FAQ", () => {
  test("attendee: seeded counts, pre-expanded row, live search + zero-state", async ({
    page,
  }) => {
    let user: SeededUser | undefined;
    try {
      user = await createAttendee({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/faq");

      await expect(
        page.getByRole("heading", { name: "FAQ", exact: true }),
      ).toBeVisible();
      // Attendee-audience seed rows: fa003 + fa004 + fa005 → 2 derived
      // topics (Reviews & ratings, Account & privacy).
      await expect(page.getByText("3 answers")).toBeVisible();
      await expect(page.getByText("2 topics")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Reviews & ratings" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Account & privacy" }),
      ).toBeVisible();

      // The Guru-reviews explainer is open by default — its answer is
      // readable without a click; a collapsed sibling's is not.
      await expect(page.getByText(/personalized promo link/)).toBeVisible();
      await expect(page.getByText(/Draft reviews can be edited/)).toBeHidden();

      // Live search: the match auto-expands, non-matching topics hide,
      // and the meta line counts. "visible" hits only fa005.
      const search = page.getByRole("searchbox", { name: "Search FAQ" });
      await search.fill("visible");
      await expect(page.getByText(/1 answer matches/)).toBeVisible();
      await expect(page.getByText(/Emails are private/)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Reviews & ratings" }),
      ).toBeHidden();

      // Zero results → the shared EmptyState with its Clear-search CTA;
      // clearing (via the search card's ×, the unambiguous aria-label)
      // restores the sections.
      await search.fill("zzz no such question");
      await expect(page.getByText("No matching questions")).toBeVisible();
      await expect(page.getByText("Clear search")).toBeVisible();
      await page.getByLabel("Clear search").click();
      await expect(
        page.getByRole("heading", { name: "Reviews & ratings" }),
      ).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });

  test("event director: audience-targeted counts and the events topic", async ({
    page,
  }) => {
    let user: SeededUser | undefined;
    try {
      user = await createEventDirector({ completeOnboarding: true });
      await signIn(page, user.email, user.password);
      await page.goto("/dashboard/faq");

      // ED-audience seed rows: fa001 + fa002 + fa004 + fa005 → 3 topics.
      await expect(page.getByText("4 answers")).toBeVisible();
      await expect(page.getByText("3 topics")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Events & claiming" }),
      ).toBeVisible();
    } finally {
      if (user) await deleteUser(user.id);
    }
  });
});
