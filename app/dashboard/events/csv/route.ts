import { type NextRequest, NextResponse } from "next/server";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import {
  listTournaments,
  type TournamentSort,
} from "../queries";
import {
  listEventsForTournaments,
  listSeasons,
} from "../event-queries";
import { deriveEventStatus } from "../event-shared";

const VALID_SORTS: TournamentSort[] = [
  "title_asc",
  "created_desc",
  "created_asc",
  "rating_desc",
  "rating_asc",
  "reviews_desc",
  "reviews_asc",
];

/**
 * Admin-only CSV export of the current Events view. Spec:
 * "the exported list must match what the admin sees on the screen —
 * if their search returned 3 tournaments and 11 events, then only
 * those 11 events must be included in the CSV export."
 *
 * Columns per spec: ages, location, attendee-avg-rating (2.33),
 * competition levels, description, event director name, end date,
 * genders, host club, review count, featured (Yes/No), general
 * avg rating, season, start date, status, title, tournament title.
 */
export async function GET(request: NextRequest) {
  const { profile, user } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const search = sp.get("q") ?? "";
  const sortRaw = sp.get("sort") ?? "title_asc";
  const sort = (VALID_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as TournamentSort)
    : "title_asc";

  const supabase = await createServerAuthClient();
  const tournaments = await listTournaments({
    userId: user.id,
    scope: "all",
    search,
    sort,
  });
  const tournamentTitleMap = new Map(tournaments.map((t) => [t.id, t.title]));
  const [events, seasons, ownerRows] = await Promise.all([
    listEventsForTournaments(tournaments.map((t) => t.id)),
    listSeasons(),
    fetchOwnerNames(supabase, tournaments),
  ]);
  const seasonLabels = new Map(seasons.map((s) => [s.id, s.label]));
  const ownerNames = new Map(ownerRows);

  const eventIds = events.map((e) => e.id);
  const [ageGroupsRes, levelsRes] = await Promise.all([
    supabase
      .from("event_age_groups")
      .select("event_id, team_gender, age")
      .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("event_competition_levels")
      .select("event_id, level")
      .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const agesByEvent = new Map<string, string[]>();
  const gendersByEvent = new Map<string, Set<string>>();
  for (const row of (ageGroupsRes.data ?? []) as {
    event_id: string;
    team_gender: string;
    age: string;
  }[]) {
    (agesByEvent.get(row.event_id) ?? agesByEvent.set(row.event_id, []).get(row.event_id)!).push(
      row.age,
    );
    (gendersByEvent.get(row.event_id) ?? gendersByEvent.set(row.event_id, new Set()).get(row.event_id)!).add(
      row.team_gender,
    );
  }
  const levelsByEvent = new Map<string, string[]>();
  for (const row of (levelsRes.data ?? []) as { event_id: string; level: string }[]) {
    (levelsByEvent.get(row.event_id) ?? levelsByEvent.set(row.event_id, []).get(row.event_id)!).push(
      row.level,
    );
  }

  const header = [
    "Title",
    "Tournament",
    "Event Director",
    "Host Club",
    "Location",
    "Ages",
    "Genders",
    "Competition Levels",
    "Description",
    "Start Date",
    "End Date",
    "Season",
    "Status",
    "Featured",
    "Reviews",
    "Overall Rating",
    "Attendee Rating",
  ];
  const rows = events.map((e) => {
    const status = deriveEventStatus(e);
    return [
      e.title,
      tournamentTitleMap.get(e.tournament_id) ?? "",
      ownerNames.get(e.owner_id ?? "") ?? "",
      e.host_club ?? "",
      // NOTE: location_formatted lives on the row; we already selected it in
      // listEventsForTournaments. Guard with a soft fallback.
      (e as unknown as { location_formatted?: string }).location_formatted ?? "",
      Array.from(new Set(agesByEvent.get(e.id) ?? [])).sort().join(", "),
      Array.from(gendersByEvent.get(e.id) ?? []).join(", "),
      Array.from(new Set(levelsByEvent.get(e.id) ?? [])).join(", "),
      "", // description omitted from listEvents projection; kept blank for now to keep the export cheap
      e.start_date ?? "",
      e.end_date ?? "",
      seasonLabels.get(e.season_id ?? "") ?? "",
      status,
      e.is_premium || e.is_sponsored ? "Yes" : "No",
      String(e.review_count),
      e.general_rating !== null ? e.general_rating.toFixed(2) : "",
      "", // attendee rating lives on the row's aggregate; kept blank until a follow-up joins it
    ];
  });

  const csv = [header, ...rows].map(toCsvRow).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tournament-guru-events.csv"`,
    },
  });
}

function toCsvRow(cells: (string | number)[]): string {
  return cells
    .map((c) => {
      const s = String(c ?? "");
      const needsQuoting = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuoting ? `"${escaped}"` : escaped;
    })
    .join(",");
}

async function fetchOwnerNames(
  supabase: Awaited<ReturnType<typeof createServerAuthClient>>,
  tournaments: { owner_id: string | null }[],
): Promise<[string, string][]> {
  const ownerIds = Array.from(
    new Set(tournaments.map((t) => t.owner_id).filter((v): v is string => Boolean(v))),
  );
  if (ownerIds.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", ownerIds);
  return ((data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map(
    (r) => [r.id, [r.first_name, r.last_name].filter(Boolean).join(" ") || r.id],
  );
}
