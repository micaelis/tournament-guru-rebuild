/**
 * Display helpers for the Activity timeline (activity/format.ts).
 *
 * The tripwire this file exists for: deSuffixTitle must strip ONLY
 * trailing division markers ("— U12 Girls", "— U10 Division") — an
 * event whose real name contains a dash ("Showcase — Fall Edition")
 * must never lose its tail. Bucketing feeds the Today/Yesterday/
 * Earlier checkpoints, so an off-by-one there scrambles the rail.
 */
import { describe, expect, it } from "vitest";
import {
  bucketOf,
  datesChip,
  demographicChips,
  deSuffixTitle,
  relativeLabel,
} from "@/app/dashboard/activity/format";

describe("deSuffixTitle", () => {
  it("strips age + gender division markers", () => {
    expect(deSuffixTitle("Spring Kickoff Cup — U12 Girls")).toBe(
      "Spring Kickoff Cup",
    );
    expect(deSuffixTitle("Summer Classic — U14 Boys")).toBe("Summer Classic");
    expect(deSuffixTitle("Spring Kickoff Cup — U10 Division")).toBe(
      "Spring Kickoff Cup",
    );
  });

  it("strips only the final dash segment", () => {
    expect(deSuffixTitle("Gulf Coast — Premier — U11 Coed")).toBe(
      "Gulf Coast — Premier",
    );
  });

  it("handles en dashes and hyphens", () => {
    expect(deSuffixTitle("Autumn Cup – U9 Boys")).toBe("Autumn Cup");
    expect(deSuffixTitle("Autumn Cup - U9 Boys")).toBe("Autumn Cup");
  });

  it("keeps dash suffixes that are part of the event's name", () => {
    expect(deSuffixTitle("Showcase — Fall Edition")).toBe(
      "Showcase — Fall Edition",
    );
    expect(deSuffixTitle("Red River Rumble")).toBe("Red River Rumble");
  });

  it("does not treat hyphenated words as suffix separators", () => {
    expect(deSuffixTitle("All-Star Invitational")).toBe(
      "All-Star Invitational",
    );
  });
});

describe("demographicChips", () => {
  it("collapses multiple ages into a range, sorted numerically", () => {
    expect(
      demographicChips([
        { age: "u10", team_gender: "boys" },
        { age: "u9", team_gender: "boys" },
        { age: "u18", team_gender: "boys" },
      ]),
    ).toEqual(["U9–U18", "Boys"]);
  });

  it("labels single age + gender", () => {
    expect(demographicChips([{ age: "u12", team_gender: "girls" }])).toEqual([
      "U12",
      "Girls",
    ]);
  });

  it("maps `both` and mixed genders to Coed", () => {
    expect(demographicChips([{ age: "u11", team_gender: "both" }])).toEqual([
      "U11",
      "Coed",
    ]);
    expect(
      demographicChips([
        { age: "u11", team_gender: "boys" },
        { age: "u11", team_gender: "girls" },
      ]),
    ).toEqual(["U11", "Coed"]);
  });

  it("returns no chips when the event has no age-group rows", () => {
    expect(demographicChips(null)).toEqual([]);
    expect(demographicChips([])).toEqual([]);
    expect(demographicChips([{ age: null, team_gender: null }])).toEqual([]);
  });
});

describe("bucketOf / relativeLabel", () => {
  const now = new Date(2026, 6, 27, 16, 47); // Mon Jul 27 2026, 4:47 PM local

  it("buckets same-day, previous-day, and older views", () => {
    expect(bucketOf(new Date(2026, 6, 27, 0, 5), now)).toBe("today");
    expect(bucketOf(new Date(2026, 6, 26, 23, 59), now)).toBe("yesterday");
    expect(bucketOf(new Date(2026, 6, 25, 23, 59), now)).toBe("earlier");
  });

  it("clock skew (future viewed_at) stays in today", () => {
    expect(bucketOf(new Date(2026, 6, 27, 23, 0), now)).toBe("today");
    expect(relativeLabel(new Date(2026, 6, 27, 17, 0), now, "today")).toBe(
      "Just now",
    );
  });

  it("renders minutes, hours, and days", () => {
    expect(relativeLabel(new Date(2026, 6, 27, 16, 46), now, "today")).toBe(
      "1 minute ago",
    );
    expect(relativeLabel(new Date(2026, 6, 27, 14, 47), now, "today")).toBe(
      "2 hours ago",
    );
    expect(relativeLabel(new Date(2026, 6, 26, 9, 0), now, "yesterday")).toBe(
      "Yesterday",
    );
    expect(relativeLabel(new Date(2026, 6, 24, 17, 18), now, "earlier")).toBe(
      "3 days ago",
    );
  });
});

describe("datesChip", () => {
  const now = new Date(2026, 6, 27, 12, 0);
  // Local-noon timestamps: date-only strings parse as UTC and would make
  // these assertions flip with the machine's timezone.
  const local = (d: string) => `${d}T12:00:00`;

  it("formats upcoming ranges, collapsing same-month ends", () => {
    expect(datesChip(local("2026-08-08"), local("2026-08-09"), now)?.label).toBe(
      "Aug 8 – 9",
    );
    expect(datesChip(local("2026-07-30"), local("2026-08-01"), now)?.label).toBe(
      "Jul 30 – Aug 1",
    );
  });

  it("marks past events as Ended", () => {
    const chip = datesChip(local("2026-07-17"), local("2026-07-19"), now);
    expect(chip).toEqual({ label: "Ended Jul 19", ended: true });
  });

  it("returns null without a start date", () => {
    expect(datesChip(null, local("2026-08-01"), now)).toBeNull();
  });
});
