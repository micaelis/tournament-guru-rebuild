/**
 * Types + pure helpers shared between server actions/queries and
 * client review UI. Kept separate so client bundles don't pull
 * next/headers transitively through the Supabase server client.
 */

export const REVIEW_BODY_MAX = 400;

/** The six category ratings that live on a review, in stable order. */
export const REVIEW_CATEGORIES = [
  { key: "rating_fields", label: "Fields" },
  { key: "rating_facilities", label: "Facilities" },
  { key: "rating_management", label: "Tournament management" },
  { key: "rating_competition", label: "Competition" },
  { key: "rating_diversity", label: "Diversity / variety" },
  { key: "rating_cost_value", label: "Cost / value" },
] as const;

export type ReviewCategoryKey = (typeof REVIEW_CATEGORIES)[number]["key"];

/** How editable is a review right now? Spec: editable up to 30 days
 * past the event end_date. */
export const REVIEW_EDIT_WINDOW_DAYS = 30;

export function reviewEditWindowMs(): number {
  return REVIEW_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Given the event's end_date (or start_date for events with no end),
 * return whether the review can still be edited today.
 */
export function isReviewStillEditable(
  eventEnd: string | null,
  now: Date = new Date(),
): boolean {
  if (!eventEnd) return true;
  const end = new Date(eventEnd);
  if (isNaN(end.getTime())) return true;
  return now.getTime() - end.getTime() <= reviewEditWindowMs();
}

/**
 * Two-decimal display for aggregate ratings ("2.33"). Null / NaN /
 * zero-count avg renders as "—".
 */
export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  if (value === 0) return "—";
  return value.toFixed(2);
}

/** Minimal row shape for the location-filter helpers — matches
 * ReviewCardRow structurally without pulling the server-only queries
 * module into client or test bundles. */
export type ReviewLocationRow = {
  status: "draft" | "published";
  snapshot_event_location: string | null;
  event?: { location_state_abbr: string | null } | null;
};

/** State code for a review's event: the live events join while the
 * event exists, else the trailing "…, XX" of the detached snapshot
 * location (snapshots are stamped only at event-deletion detach). */
export function reviewStateAbbr(row: ReviewLocationRow): string | null {
  if (row.event?.location_state_abbr) return row.event.location_state_abbr;
  const tail = row.snapshot_event_location?.slice(-2);
  return tail && /^[A-Z]{2}$/.test(tail) ? tail : null;
}

/**
 * Chips for the My Reviews location filter: one per state the user has
 * a PUBLISHED review in — 2-letter code plus the count of their
 * published reviews there, A→Z. Draft-only states surface no chip;
 * rows with no derivable state are skipped.
 */
export function deriveLocationChips(
  rows: ReviewLocationRow[],
): { state: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "published") continue;
    const abbr = reviewStateAbbr(row);
    if (abbr) counts.set(abbr, (counts.get(abbr) ?? 0) + 1);
  }
  return Array.from(counts, ([state, count]) => ({ state, count })).sort(
    (a, b) => a.state.localeCompare(b.state),
  );
}

/**
 * When would_return applies (coach + team_manager reviews). Parents /
 * spectators aren't asked; the DB column is nullable so their reviews
 * carry NULL and don't feed the % calculation.
 */
export function needsWouldReturn(reviewerRole: string | null): boolean {
  return reviewerRole === "coach" || reviewerRole === "team_manager";
}

/**
 * Role display label for a review card — coach reviews from a
 * verified-promo landing surface get "Verified Coach"; everything
 * else falls back to the role's public label. Kept as a single map
 * so future role additions land in one place.
 */
export function roleDisplayLabel(
  role: string | null,
  guru: boolean,
): string {
  if (role === "coach" && guru) return "Verified Coach";
  switch (role) {
    case "coach":
      return "Coach";
    case "team_manager":
      return "Team Manager";
    case "parent_spectator":
      return "Parent / Spectator";
    case "event_director":
      return "Event Director";
    case "event_admin":
      return "Event Admin";
    case "club_director":
      return "Club Director";
    default:
      return role ?? "Reviewer";
  }
}
