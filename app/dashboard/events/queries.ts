import { createServerAuthClient } from "@/lib/supabase/server";
import { fetchInChunks } from "@/lib/supabase/in-chunks";

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
  | "reviews_asc"
  | "owner_asc"
  | "owner_desc";

const SORT_MAP: Record<
  Exclude<TournamentSort, "owner_asc" | "owner_desc">,
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
 *
 * ED scope ('own'): title-only ilike search, straight SQL sort. Small
 * data, minimal work.
 * Admin scope ('all'): also matches on the owner's full name — spec
 * says "The search box should search by event title AND event owner's
 * full name" — and unlocks the Owner sort. We fetch tournaments +
 * their owner rows in two round trips, filter + sort in JS. Admin
 * volume is low so the join-in-app cost is fine and keeps the SQL
 * simple.
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
  const trimmed = search?.trim() ?? "";

  if (scope === "own") {
    if (sort === "owner_asc" || sort === "owner_desc") {
      // Owner sort is meaningless when every row is your own; fall back.
      sort = "title_asc";
    }
    const { column, ascending } = SORT_MAP[sort];
    const q = supabase
      .from("tournaments")
      .select(TOURNAMENT_COLUMNS)
      .eq("owner_id", userId);
    const searched = trimmed ? q.ilike("title", `%${trimmed}%`) : q;
    const { data, error } = await searched.order(column, { ascending });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as TournamentRow[];
  }

  // Admin scope: raw fetch, then filter + sort in JS.
  const { data: allTournaments, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS);
  if (error) throw new Error(error.message);
  let list = (allTournaments ?? []) as unknown as TournamentRow[];

  const ownerIds = Array.from(
    new Set(list.map((t) => t.owner_id).filter((v): v is string => Boolean(v))),
  );
  const ownerNames = ownerIds.length
    ? await fetchOwnerFullNames(supabase, ownerIds)
    : new Map<string, string>();

  if (trimmed) {
    const needle = trimmed.toLowerCase();
    list = list.filter((t) => {
      if (t.title.toLowerCase().includes(needle)) return true;
      const name = t.owner_id ? ownerNames.get(t.owner_id) : undefined;
      return name ? name.toLowerCase().includes(needle) : false;
    });
  }

  if (sort === "owner_asc" || sort === "owner_desc") {
    list.sort((a, b) => {
      const aName = (a.owner_id ? ownerNames.get(a.owner_id) : "") ?? "";
      const bName = (b.owner_id ? ownerNames.get(b.owner_id) : "") ?? "";
      const cmp = aName.localeCompare(bName);
      return sort === "owner_asc" ? cmp : -cmp;
    });
  } else {
    const { column, ascending } = SORT_MAP[sort];
    list.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[column];
      const bv = (b as unknown as Record<string, unknown>)[column];
      const cmp = compareUnknown(av, bv);
      return ascending ? cmp : -cmp;
    });
  }

  return list;
}

function compareUnknown(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

async function fetchOwnerFullNames(
  supabase: Awaited<ReturnType<typeof createServerAuthClient>>,
  ownerIds: string[],
): Promise<Map<string, string>> {
  // Admin scope: owners of EVERY tournament — batch the .in().
  const rows = await fetchInChunks(ownerIds, async (chunk) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", chunk);
    return (data ?? []) as {
      id: string;
      first_name: string | null;
      last_name: string | null;
    }[];
  });
  const out = new Map<string, string>();
  for (const row of rows) {
    out.set(row.id, [row.first_name, row.last_name].filter(Boolean).join(" "));
  }
  return out;
}

/**
 * Admin-only helper: fetch each tournament owner's display name for the
 * page's "Owner" column + row-level "created by" chip. EDs don't need
 * this because they only see themselves.
 */
export async function fetchTournamentOwnerNames(
  ownerIds: string[],
): Promise<Map<string, string>> {
  if (ownerIds.length === 0) return new Map();
  const supabase = await createServerAuthClient();
  return fetchOwnerFullNames(supabase, ownerIds);
}

