import { describe, expect, it } from "vitest";
import { deriveFaqTopic } from "@/lib/faq/topics";

/**
 * The dashboard FAQ page's presentational topic buckets (S12.43) —
 * title-keyword derivation because the schema has no topic column.
 */
describe("deriveFaqTopic", () => {
  it("buckets every seeded FAQ title where the page shows it", () => {
    expect(deriveFaqTopic("How do I get my event listed?")).toBe("events");
    expect(
      deriveFaqTopic("What's the difference between free and premium?"),
    ).toBe("events");
    expect(deriveFaqTopic("Why can't I edit my review anymore?")).toBe(
      "reviews",
    );
    expect(deriveFaqTopic("How do verified (GURU) reviews work?")).toBe(
      "reviews",
    );
    expect(deriveFaqTopic("Is my email visible to other users?")).toBe(
      "account",
    );
  });

  it("keeps the brand name out of the buckets", () => {
    expect(deriveFaqTopic("What is Tournament Guru?")).toBe("start");
  });

  it("prefers account over reviews for account-lifecycle questions", () => {
    expect(
      deriveFaqTopic("What happens to my reviews if I delete my account?"),
    ).toBe("account");
  });

  it("prefers reviews over events when both appear in a title", () => {
    expect(
      deriveFaqTopic("Can an event director edit or remove my review?"),
    ).toBe("reviews");
  });

  it("falls back to Getting started for unmatched titles", () => {
    expect(deriveFaqTopic("How do I find tournaments near me?")).toBe("start");
  });
});
