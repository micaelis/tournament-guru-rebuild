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
  host_club: string | null;
  start_date: string | null;
  end_date: string | null;
  lifecycle: "draft" | "active" | "canceled";
  is_premium: boolean;
  is_sponsored: boolean;
  owner_id: string | null;
  season_id: string | null;
  general_rating: number | null;
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
