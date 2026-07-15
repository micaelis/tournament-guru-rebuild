import { createServerAuthClient } from "@/lib/supabase/server";

/**
 * Data shapes used by the ED / Admin Events page. Fields track only the
 * columns the shell actually renders — kept narrow so the page fetch
 * stays cheap and RLS + column grants remain the primary gate.
 */
export type TournamentRow = {
  id: string;
  title: string;
  recurring: boolean;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  general_rating: number | null;
  coach_rating: number | null;
  attendee_rating: number | null;
  review_count: number;
  avg_fields: number | null;
  avg_facilities: number | null;
  avg_management: number | null;
  avg_competition: number | null;
  avg_diversity: number | null;
  avg_cost_value: number | null;
};

const TOURNAMENT_COLUMNS =
  "id, title, recurring, owner_id, created_by, created_at, general_rating, coach_rating, attendee_rating, review_count, avg_fields, avg_facilities, avg_management, avg_competition, avg_diversity, avg_cost_value";

export type TournamentSort =
  | "title_asc"
  | "created_desc"
  | "created_asc"
  | "rating_desc"
  | "rating_asc"
  | "reviews_desc"
  | "reviews_asc";

const SORT_MAP: Record<
  TournamentSort,
  { column: string; ascending: boolean }
> = {
  title_asc: { column: "title", ascending: true },
  created_desc: { column: "created_at", ascending: false },
  created_asc: { column: "created_at", ascending: true },
  rating_desc: { column: "general_rating", ascending: false },
  rating_asc: { column: "general_rating", ascending: true },
  reviews_desc: { column: "review_count", ascending: false },
  reviews_asc: { column: "review_count", ascending: true },
};

/**
 * List tournaments visible to the current user for the events page.
 * ED: their own. Admin: all. Filtering by title happens in-DB (ilike).
 * Sort maps 1:1 to a column; A-Z title is the default.
 */
export async function listTournaments({
  userId,
  scope,
  search,
  sort = "title_asc",
}: {
  userId: string;
  scope: "own" | "all";
  search?: string;
  sort?: TournamentSort;
}): Promise<TournamentRow[]> {
  const supabase = await createServerAuthClient();
  const { column, ascending } = SORT_MAP[sort];

  const base = supabase.from("tournaments").select(TOURNAMENT_COLUMNS);
  const scoped = scope === "own" ? base.eq("owner_id", userId) : base;
  const searched =
    search && search.trim() ? scoped.ilike("title", `%${search.trim()}%`) : scoped;
  const { data, error } = await searched.order(column, { ascending });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TournamentRow[];
}

/**
 * Counts events under a set of tournaments (for the "no events yet"
 * placeholder). One query fetches all rows; caller maps by tournament_id.
 */
export async function countEventsPerTournament(
  tournamentIds: string[],
): Promise<Map<string, number>> {
  if (tournamentIds.length === 0) return new Map();
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("events")
    .select("tournament_id")
    .in("tournament_id", tournamentIds);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { tournament_id: string }[]) {
    counts.set(row.tournament_id, (counts.get(row.tournament_id) ?? 0) + 1);
  }
  return counts;
}
