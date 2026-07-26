/**
 * My Reviews location filter (S12.27) — the pure chip derivation.
 * States come from the live events join first (snapshots are stamped
 * only at event-deletion detach), fall back to the snapshot location's
 * trailing state code, and chips count PUBLISHED reviews only.
 */
import { describe, expect, it } from "vitest";
import {
  deriveLocationChips,
  reviewStateAbbr,
  type ReviewLocationRow,
} from "@/lib/reviews/shared";

function row(over: Partial<ReviewLocationRow> = {}): ReviewLocationRow {
  return {
    status: "published",
    snapshot_event_location: null,
    event: null,
    ...over,
  };
}

describe("reviewStateAbbr", () => {
  it("prefers the live events join", () => {
    expect(
      reviewStateAbbr(
        row({
          event: { location_state_abbr: "MO" },
          snapshot_event_location: "Somewhere, IL",
        }),
      ),
    ).toBe("MO");
  });

  it("falls back to the snapshot location's trailing state code", () => {
    expect(
      reviewStateAbbr(row({ snapshot_event_location: "St. Louis, MO" })),
    ).toBe("MO");
  });

  it("rejects tails that aren't a 2-letter state code", () => {
    expect(reviewStateAbbr(row({ snapshot_event_location: "Springfield" }))).toBeNull();
    expect(reviewStateAbbr(row({ snapshot_event_location: "st. louis, mo" }))).toBeNull();
    expect(reviewStateAbbr(row({ snapshot_event_location: null }))).toBeNull();
    expect(reviewStateAbbr(row({ event: { location_state_abbr: null } }))).toBeNull();
  });
});

describe("deriveLocationChips", () => {
  it("counts published reviews per state, sorted A→Z", () => {
    const chips = deriveLocationChips([
      row({ event: { location_state_abbr: "MO" } }),
      row({ event: { location_state_abbr: "MO" } }),
      row({ event: { location_state_abbr: "IL" } }),
      // Detached row — state from the snapshot.
      row({ snapshot_event_location: "Chicago, IL" }),
    ]);
    expect(chips).toEqual([
      { state: "IL", count: 2 },
      { state: "MO", count: 2 },
    ]);
  });

  it("gives draft-only states no chip", () => {
    const chips = deriveLocationChips([
      row({ status: "draft", event: { location_state_abbr: "TX" } }),
      row({ event: { location_state_abbr: "MO" } }),
    ]);
    expect(chips).toEqual([{ state: "MO", count: 1 }]);
  });

  it("skips rows with no derivable state and handles the empty list", () => {
    expect(deriveLocationChips([])).toEqual([]);
    expect(
      deriveLocationChips([row(), row({ snapshot_event_location: "Nowhere" })]),
    ).toEqual([]);
  });
});
