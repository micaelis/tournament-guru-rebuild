/**
 * Date-derived status + ordering rules for the premium Key dates &
 * deadlines timeline (app/components/events/KeyDatesTimeline).
 *
 * The rules under test (DECISIONS S12.48): a past milestone is Done,
 * every milestone on the soonest still-to-come date is Next up, later
 * futures are Upcoming, and the derived "Tournament Kicks Off" anchor
 * (= the event's start date) always reads Event day. Rows sort by
 * date; dateless milestones trail as TBD. No ED milestones → no rows
 * at all — the kick-off alone doesn't warrant the card.
 */
import { describe, expect, it } from "vitest";
import {
  buildKeyDateRows,
  KICKOFF_TITLE,
  type KeyDateMilestone,
} from "@/app/components/events/KeyDatesTimeline";

const TODAY = "2026-07-27";

const m = (
  title: string,
  milestone_date: string | null,
  description: string | null = null,
): KeyDateMilestone => ({ title, milestone_date, description });

describe("buildKeyDateRows — statuses", () => {
  it("derives Done / Next up / Upcoming / Event day from dates", () => {
    const rows = buildKeyDateRows(
      [
        m("Early-Bird Pricing Ends", "2026-05-19"),
        m("Registration Deadline", "2026-06-12"),
        m("Rosters Due", "2026-08-05"),
        m("Team Check-In", "2026-08-20"),
      ],
      "2026-08-21",
      TODAY,
    );
    expect(rows.map((r) => [r.title, r.kind])).toEqual([
      ["Early-Bird Pricing Ends", "done"],
      ["Registration Deadline", "done"],
      ["Rosters Due", "next"],
      ["Team Check-In", "upcoming"],
      [KICKOFF_TITLE, "event"],
    ]);
  });

  it("a milestone dated today is the Next up candidate, not Done", () => {
    const rows = buildKeyDateRows(
      [m("Check-in opens", TODAY), m("Later", "2026-08-01")],
      "2026-08-02",
      TODAY,
    );
    expect(rows.map((r) => [r.title, r.kind])).toEqual([
      ["Check-in opens", "next"],
      ["Later", "upcoming"],
      [KICKOFF_TITLE, "event"],
    ]);
  });

  it("same-date soonest futures are all Next up", () => {
    const rows = buildKeyDateRows(
      [m("Rosters", "2026-08-05"), m("Payments", "2026-08-05")],
      null,
      TODAY,
    );
    expect(rows.map((r) => r.kind)).toEqual(["next", "next"]);
  });

  it("the kick-off is Event day even when the start date is past", () => {
    const rows = buildKeyDateRows(
      [m("Registration Deadline", "2026-06-12")],
      "2026-07-01",
      TODAY,
    );
    expect(rows.at(-1)).toMatchObject({
      title: KICKOFF_TITLE,
      dateIso: "2026-07-01",
      kind: "event",
    });
  });
});

describe("buildKeyDateRows — ordering + gating", () => {
  it("sorts by date; the kick-off closes a shared date; TBD trails", () => {
    const rows = buildKeyDateRows(
      [
        m("Dateless", null),
        m("Finals seeding", "2026-08-21"),
        m("Early bird", "2026-05-19"),
      ],
      "2026-08-21",
      TODAY,
    );
    expect(rows.map((r) => r.title)).toEqual([
      "Early bird",
      "Finals seeding",
      KICKOFF_TITLE,
      "Dateless",
    ]);
    // A dateless milestone can't be judged against today → Upcoming/TBD.
    expect(rows.at(-1)).toMatchObject({ dateIso: null, kind: "upcoming" });
  });

  it("no ED milestones → no rows (the kick-off alone doesn't render)", () => {
    expect(buildKeyDateRows([], "2026-08-21", TODAY)).toEqual([]);
    expect(buildKeyDateRows([m("   ", "2026-08-01")], "2026-08-21", TODAY)).toEqual([]);
  });

  it("a missing start date skips the kick-off row only", () => {
    const rows = buildKeyDateRows([m("Rosters", "2026-08-05")], null, TODAY);
    expect(rows.map((r) => r.title)).toEqual(["Rosters"]);
  });

  it("trims titles/descriptions and blanks empty descriptions to null", () => {
    const rows = buildKeyDateRows(
      [m("  Rosters Due  ", "2026-08-05", "  ")],
      null,
      TODAY,
    );
    expect(rows[0]).toMatchObject({ title: "Rosters Due", description: null });
  });

  it("normalizes timestamps to their date part", () => {
    const rows = buildKeyDateRows(
      [m("Rosters", "2026-08-05T10:30:00Z")],
      "2026-08-21T00:00:00Z",
      TODAY,
    );
    expect(rows.map((r) => r.dateIso)).toEqual(["2026-08-05", "2026-08-21"]);
  });
});
