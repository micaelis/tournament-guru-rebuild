import "server-only";
import { createAnonServerClient } from "@/lib/supabase/server";
import { legacyStatus } from "@/lib/events/status";
import {
  AGE_BRACKETS,
  SURFACES,
  COMPETITION_LEVELS,
  TEAM_GENDERS,
} from "@/lib/enums";
import type { EventRow, EventFacets, EventSort } from "@/app/components/types";
import { boundingBox, milesBetween } from "@/lib/geo";

export type SearchFilters = {
  q?: string;
  ages?: string[];
  genders?: string[];
  levels?: string[];
  surfaces?: string[];
  states?: string[];
  dateStart?: string | null;
  dateEnd?: string | null;
  openOnly?: boolean;
  /** Only events that have already ended — the "write a review" picker. */
  concludedOnly?: boolean;
  /** Distance-from filter: all three must be present to take effect.
   *  Events without coordinates are excluded while it's active. */
  distanceMiles?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
};

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const SEARCH_SELECT =
  "id, owner_id, title, description, host_club, logo_url, location_formatted, location_state_abbr, location_lat, location_lng, start_date, end_date, lifecycle, is_premium, is_general_ad, region, teams_attended_prev_year, would_return_pct, general_rating, coach_rating, attendee_rating, review_count, created_at, event_age_groups(age, team_gender), event_competition_levels(level), event_surfaces(surface)";

/**
 * Facet value sets for the search filter drawer. The taxonomy UI expects
 * lowercase enum values (u12 / boys / turf); the DB stores ages uppercase
 * (U12), so ages are lowercased here and re-uppercased at query time.
 */
export async function getEventFacets(): Promise<EventFacets> {
  const supabase = createAnonServerClient();
  const { data: states } = await supabase
    .from("us_states")
    .select("code")
    .order("code");
  return {
    ages: AGE_BRACKETS.map((a) => a.toLowerCase()),
    genders: TEAM_GENDERS.map((g) => g.value),
    levels: COMPETITION_LEVELS.map((l) => l.value),
    surfaces: SURFACES.map((s) => s.value),
    states: ((states ?? []) as { code: string }[]).map((s) => s.code),
  };
}

type RawSearchRow = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  host_club: string | null;
  logo_url: string | null;
  location_formatted: string | null;
  location_state_abbr: string | null;
  location_lat: number | null;
  location_lng: number | null;
  start_date: string | null;
  end_date: string | null;
  lifecycle: "draft" | "active" | "canceled";
  is_premium: boolean;
  is_general_ad: boolean;
  region: string | null;
  teams_attended_prev_year: number | null;
  would_return_pct: number | null;
  general_rating: number | null;
  coach_rating: number | null;
  attendee_rating: number | null;
  review_count: number;
  created_at: string;
  event_age_groups: { age: string | null; team_gender: string | null }[] | null;
  event_competition_levels: { level: string | null }[] | null;
  event_surfaces: { surface: string | null }[] | null;
};

export async function searchEvents(
  filters: SearchFilters,
  opts: { page?: number; pageSize?: number; sort?: EventSort } = {},
): Promise<{ data: EventRow[]; total: number }> {
  const supabase = createAnonServerClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 12;
  const sort = opts.sort ?? "teams";

  // Child-table facet filters resolve to matching event-id sets, then
  // intersect (an event must satisfy every active facet group). Each
  // active group contributes a set of matching event ids; they're
  // intersected at the end (no closure mutation, so type narrows cleanly).
  const dedupe = (rows: { event_id: string }[] | null) =>
    Array.from(new Set((rows ?? []).map((r) => r.event_id)));
  const idSets: string[][] = [];

  if (filters.ages?.length) {
    const { data } = await supabase
      .from("event_age_groups")
      .select("event_id")
      .in(
        "age",
        filters.ages.map((a) => a.toUpperCase()),
      );
    idSets.push(dedupe(data as { event_id: string }[] | null));
  }
  if (filters.genders?.length) {
    const { data } = await supabase
      .from("event_age_groups")
      .select("event_id")
      .in("team_gender", filters.genders);
    idSets.push(dedupe(data as { event_id: string }[] | null));
  }
  if (filters.surfaces?.length) {
    const { data } = await supabase
      .from("event_surfaces")
      .select("event_id")
      .in("surface", filters.surfaces);
    idSets.push(dedupe(data as { event_id: string }[] | null));
  }
  if (filters.levels?.length) {
    const { data } = await supabase
      .from("event_competition_levels")
      .select("event_id")
      .in("level", filters.levels);
    idSets.push(dedupe(data as { event_id: string }[] | null));
  }
  if (
    filters.distanceMiles != null &&
    filters.centerLat != null &&
    filters.centerLng != null
  ) {
    // Cheap SQL bounding-box prefilter, exact Haversine on the candidates.
    // The box over-includes corners; the JS pass trims them precisely.
    const box = boundingBox(
      filters.centerLat,
      filters.centerLng,
      filters.distanceMiles,
    );
    const { data } = await supabase
      .from("events")
      .select("id, location_lat, location_lng")
      .eq("lifecycle", "active")
      .gte("location_lat", box.minLat)
      .lte("location_lat", box.maxLat)
      .gte("location_lng", box.minLng)
      .lte("location_lng", box.maxLng);
    const within = (
      (data ?? []) as { id: string; location_lat: number; location_lng: number }[]
    )
      .filter(
        (r) =>
          milesBetween(
            filters.centerLat!,
            filters.centerLng!,
            r.location_lat,
            r.location_lng,
          ) <= filters.distanceMiles!,
      )
      .map((r) => r.id);
    idSets.push(within);
  }

  const matchingIds: string[] | null =
    idSets.length === 0
      ? null
      : idSets.reduce((acc, set) => {
          const s = new Set(set);
          return acc.filter((x) => s.has(x));
        });

  let query = supabase
    .from("events")
    .select(SEARCH_SELECT, { count: "exact" })
    .eq("lifecycle", "active");

  if (filters.states?.length)
    query = query.in("location_state_abbr", filters.states);
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    query = query.or(
      `title.ilike.${like},host_club.ilike.${like},location_formatted.ilike.${like}`,
    );
  }
  if (filters.dateStart) query = query.gte("start_date", filters.dateStart);
  if (filters.dateEnd) query = query.lte("start_date", filters.dateEnd);
  if (filters.openOnly)
    query = query.gte("end_date", new Date().toISOString().slice(0, 10));
  if (filters.concludedOnly)
    query = query.lt("end_date", new Date().toISOString().slice(0, 10));
  if (matchingIds !== null) {
    query =
      matchingIds.length === 0
        ? query.eq("id", ZERO_UUID)
        : query.in("id", matchingIds);
  }

  // Premium always sorts first; the chosen key breaks ties within tier.
  query = query.order("is_premium", { ascending: false });
  if (sort === "date") query = query.order("start_date", { ascending: true });
  else if (sort === "rating")
    query = query.order("general_rating", { ascending: false, nullsFirst: false });
  else
    query = query.order("teams_attended_prev_year", {
      ascending: false,
      nullsFirst: false,
    });
  query = query.order("created_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const { data, count } = await query.range(from, from + pageSize - 1);
  const rows = (data ?? []) as RawSearchRow[];
  if (rows.length === 0) return { data: [], total: count ?? 0 };

  const ownerIds = Array.from(
    new Set(rows.map((r) => r.owner_id).filter(Boolean)),
  ) as string[];
  const [{ data: owners }, { data: reviewRows }] = await Promise.all([
    ownerIds.length
      ? supabase
          .from("public_event_owners")
          .select("id, org_logo_url, profile_photo_url")
          .in("id", ownerIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            org_logo_url: string | null;
            profile_photo_url: string | null;
          }[],
        }),
    supabase
      .from("reviews")
      .select("event_id, reviewer_role")
      .eq("status", "published")
      .in(
        "event_id",
        rows.map((r) => r.id),
      ),
  ]);
  const logoByOwner = new Map(
    (
      (owners ?? []) as {
        id: string;
        org_logo_url: string | null;
        profile_photo_url: string | null;
      }[]
    ).map((o) => [o.id, o.org_logo_url ?? o.profile_photo_url ?? null] as const),
  );
  const coachCount = new Map<string, number>();
  const attendeeCount = new Map<string, number>();
  for (const rv of (reviewRows ?? []) as {
    event_id: string;
    reviewer_role: string | null;
  }[]) {
    const bucket = rv.reviewer_role === "coach" ? coachCount : attendeeCount;
    bucket.set(rv.event_id, (bucket.get(rv.event_id) ?? 0) + 1);
  }

  const mapped = rows.map((r) => {
    const ages = Array.from(
      new Set((r.event_age_groups ?? []).map((g) => g.age?.toLowerCase()).filter(Boolean)),
    ) as string[];
    const genders = Array.from(
      new Set((r.event_age_groups ?? []).map((g) => g.team_gender).filter(Boolean)),
    ) as string[];
    const levels = Array.from(
      new Set((r.event_competition_levels ?? []).map((g) => g.level).filter(Boolean)),
    ) as string[];
    const surfaces = Array.from(
      new Set((r.event_surfaces ?? []).map((g) => g.surface).filter(Boolean)),
    ) as string[];
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      host_club: r.host_club,
      location_text: r.location_formatted,
      state: r.location_state_abbr,
      start_date: r.start_date,
      end_date: r.end_date,
      status: legacyStatus(r),
      premium: r.is_premium,
      spotlight: r.is_general_ad,
      logo: r.logo_url,
      owner_id: r.owner_id,
      host_logo: r.owner_id ? logoByOwner.get(r.owner_id) ?? null : null,
      general_rating: r.general_rating,
      coach_rating: r.coach_rating,
      attendee_rating: r.attendee_rating,
      reviews: r.review_count,
      coach_reviews: coachCount.get(r.id) ?? 0,
      attendee_reviews: attendeeCount.get(r.id) ?? 0,
      would_return_pct: r.would_return_pct,
      nr_teams_last_year: r.teams_attended_prev_year,
      created_at: r.created_at,
      region: r.region,
      lat: r.location_lat,
      lng: r.location_lng,
      event_ages: ages.map((age) => ({ age })),
      event_genders: genders.map((gender) => ({ gender })),
      event_competition_levels: levels.map((level) => ({ level })),
      event_fields: surfaces.map((surface) => ({ surface })),
    } satisfies EventRow;
  });

  return { data: mapped, total: count ?? 0 };
}
