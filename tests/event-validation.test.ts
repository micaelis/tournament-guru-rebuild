/**
 * Draft-vs-publish field rules for the event form (event-validation.ts).
 *
 * The tripwire this file exists for: "Save as draft" on a form whose
 * only sponsor row is the blank "+ Add sponsor" scaffolding used to
 * fail with "One of your sponsor logos is invalid". Blank rows must
 * never validate (any intent), and drafts must never be blocked by
 * sponsor rules at all — only the title is mandatory for a draft.
 * Reintroducing either false positive flips these tests red.
 */
import { describe, expect, it } from "vitest";
import {
  collectEventFieldErrors,
  meaningfulSponsors,
  milestonesForSave,
  type EventBaseFacts,
  type MilestoneInput,
  type SponsorInput,
} from "@/app/dashboard/events/event-validation";

const BLANK_SPONSOR: SponsorInput = { name: "", link: "", logo_url: "" };

const emptyBase: EventBaseFacts = {
  title: "",
  logo_url: null,
  website_url: null,
  host_club: null,
  start_date: null,
  end_date: null,
  description: null,
  location_formatted: null,
  region: null,
  season_id: null,
};

const publishableBase: EventBaseFacts = {
  title: "Summer Cup",
  logo_url: "https://cdn.example.com/logo.png",
  website_url: "https://summercup.example.com",
  host_club: "FC Example",
  start_date: "2026-08-01",
  end_date: "2026-08-03",
  description: "Three days of soccer.",
  location_formatted: "Austin, TX",
  region: "III",
  season_id: "6b1f0d7e-0000-4000-8000-000000000001",
};

function collect(
  intent: "draft" | "publish" | "update",
  sponsors: SponsorInput[],
  base: EventBaseFacts = publishableBase,
) {
  return collectEventFieldErrors({
    intent,
    base,
    ageGroups: [],
    sponsors,
    levels: ["middle"],
    surfaces: ["grass"],
    features: [],
  });
}

describe("meaningfulSponsors", () => {
  it("drops all-blank and whitespace-only scaffold rows", () => {
    expect(meaningfulSponsors([BLANK_SPONSOR])).toEqual([]);
    expect(
      meaningfulSponsors([{ name: "  ", link: "", logo_url: " " }]),
    ).toEqual([]);
  });

  it("keeps a row once any field carries text", () => {
    const partial = { name: "Acme", link: "", logo_url: "" };
    expect(meaningfulSponsors([BLANK_SPONSOR, partial])).toEqual([partial]);
  });
});

describe("collectEventFieldErrors — draft", () => {
  it("draft with a title and empty sponsors saves cleanly", () => {
    expect(collect("draft", [])).toEqual({});
  });

  it("draft with only the blank scaffold row saves cleanly (the bug)", () => {
    expect(collect("draft", [BLANK_SPONSOR])).toEqual({});
  });

  it("draft is never blocked by sponsor rules, even invalid filled rows", () => {
    const errors = collect("draft", [
      { name: "Acme", link: "javascript:alert(1)", logo_url: "not-a-url" },
    ]);
    expect(errors.sponsors).toBeUndefined();
  });

  it("draft still requires a title", () => {
    const errors = collect("draft", [], emptyBase);
    expect(errors).toEqual({ title: "Title is required." });
  });
});

describe("collectEventFieldErrors — publish/update", () => {
  it("publish ignores blank scaffold rows", () => {
    expect(collect("publish", [BLANK_SPONSOR]).sponsors).toBeUndefined();
  });

  it("publish rejects incomplete sponsor rows", () => {
    const errors = collect("publish", [
      { name: "Acme", link: "", logo_url: "" },
    ]);
    expect(errors.sponsors).toBe(
      "Each sponsor needs a name, link, and logo URL.",
    );
  });

  it("publish rejects unsafe sponsor URLs", () => {
    const errors = collect("publish", [
      {
        name: "Acme",
        link: "javascript:alert(1)",
        logo_url: "https://cdn.example.com/a.png",
      },
    ]);
    expect(errors.sponsors).toBe("One of your sponsor links is invalid.");
  });

  it("update (live event) enforces sponsor rules too", () => {
    const errors = collect("update", [
      { name: "Acme", link: "https://acme.example.com", logo_url: "data:text/html,x" },
    ]);
    expect(errors.sponsors).toBe("One of your sponsor logos is invalid.");
  });

  it("publish enforces the mandatory base fields", () => {
    const errors = collectEventFieldErrors({
      intent: "publish",
      base: emptyBase,
      ageGroups: [],
      sponsors: [],
      levels: [],
      surfaces: [],
      features: [],
    });
    for (const key of [
      "title",
      "logo_url",
      "website_url",
      "host_club",
      "start_date",
      "end_date",
      "description",
      "location_formatted",
      "region",
      "season_id",
      "competition_levels",
      "surfaces",
    ]) {
      expect(errors[key], key).toBeDefined();
    }
  });
});

describe("milestonesForSave (S12.47 — key dates are premium-only)", () => {
  const rows: MilestoneInput[] = [
    {
      title: "Early-Bird Pricing Ends",
      milestone_date: "2027-05-19",
      description: "Save $50 per team",
    },
    { title: "", milestone_date: "", description: "" }, // untouched scaffold
    { title: "  Registration Deadline  ", milestone_date: "2027-06-12", description: "" },
  ];

  it("a non-premium save ignores the milestone payload entirely", () => {
    expect(milestonesForSave(false, rows)).toEqual([]);
  });

  it("a premium save keeps titled rows (dates/descriptions untouched) and drops blank scaffolds", () => {
    expect(milestonesForSave(true, rows)).toEqual([rows[0], rows[2]]);
  });

  it("tolerates a crafted payload with a non-string title", () => {
    const crafted = [{ milestone_date: "2027-01-01" }] as unknown as MilestoneInput[];
    expect(milestonesForSave(true, crafted)).toEqual([]);
  });
});
