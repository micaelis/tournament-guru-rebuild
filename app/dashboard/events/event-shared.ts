/**
 * Types + pure helpers shared between server queries and client
 * components. Kept separate from event-queries.ts so client imports
 * don't pull `next/headers` transitively through the Supabase server
 * client factory.
 */

export type EventListRow = {
  id: string;
  tournament_id: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  host_club: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  lifecycle: "draft" | "active" | "canceled";
  is_premium: boolean;
  is_general_ad: boolean;
  owner_id: string | null;
  season_id: string | null;
  location_formatted: string | null;
  general_rating: number | null;
  coach_rating: number | null;
  attendee_rating: number | null;
  would_return_pct: number | null;
  review_count: number;
  avg_fields: number | null;
  avg_facilities: number | null;
  avg_management: number | null;
  avg_competition: number | null;
  avg_diversity: number | null;
  avg_cost_value: number | null;
};

/**
 * Derives the display status from lifecycle + dates (matches the SQL
 * helper event_display_status). Recomputed at read-time so it never
 * goes stale — dates ticking past don't require any write.
 */
export function deriveEventStatus(row: {
  lifecycle: "draft" | "active" | "canceled";
  start_date: string | null;
  end_date: string | null;
}): "Draft" | "Upcoming" | "Ongoing" | "Concluded" | "Canceled" {
  if (row.lifecycle === "draft") return "Draft";
  if (row.lifecycle === "canceled") return "Canceled";
  const today = new Date().toISOString().slice(0, 10);
  if (row.end_date && row.end_date < today) return "Concluded";
  if (row.start_date && row.start_date > today) return "Upcoming";
  return "Ongoing";
}

/** The toolbar's status tabs. "published" groups Upcoming + Ongoing —
 *  the reader-facing meaning of a live listing. */
export type EventStatusFilter =
  | "all"
  | "published"
  | "draft"
  | "concluded"
  | "canceled";

export const EVENT_STATUS_FILTERS: EventStatusFilter[] = [
  "all",
  "published",
  "draft",
  "concluded",
  "canceled",
];

export function matchesStatusFilter(
  status: ReturnType<typeof deriveEventStatus>,
  filter: EventStatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "published":
      return status === "Upcoming" || status === "Ongoing";
    case "draft":
      return status === "Draft";
    case "concluded":
      return status === "Concluded";
    case "canceled":
      return status === "Canceled";
  }
}

/**
 * The events table's aligned grid — one definition shared by the column
 * header band (TournamentCard) and every row (EventRow) so the two can
 * never drift. Below xl the cells stack into a card-ish block.
 * Columns: Event · Status · Dates · Reviews & rating · actions.
 */
/** The text-link treatment for the list's collapsible toggles (Ratings
 *  breakdown, Show/Hide events, per-row Breakdown). Open = the app-wide
 *  red "chosen" tint. */
export function breakdownLinkClass(open: boolean): string {
  return [
    "inline-flex items-center gap-1 font-bold underline underline-offset-[3px] transition-colors",
    open
      ? "text-red-700 decoration-red-300"
      : "text-slate-600 decoration-slate-300 hover:text-red-600 hover:decoration-red-300",
  ].join(" ");
}

/** The list page's surface treatment: soft-shadow white card, no gray
 *  border (the toolbar + every tournament card share it). No overflow
 *  clipping — the row "…" menus must escape the card. */
export const LIST_CARD_CLASS =
  "rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,.05),0_14px_34px_-22px_rgba(15,23,42,.18)]";

export const EVENT_GRID_CLASS =
  "grid items-center gap-x-3 gap-y-2 xl:[grid-template-columns:minmax(0,2.5fr)_112px_150px_minmax(0,1.3fr)_236px]";
