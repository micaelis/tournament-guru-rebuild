import "server-only";
import { createAnonServerClient } from "@/lib/supabase/server";
import { unwrap, unwrapRows } from "@/lib/supabase/unwrap";
import { deriveEventStatus } from "@/app/dashboard/events/event-shared";
import { legacyStatus } from "@/lib/events/status";
import type {
  DirectorProfile,
  EventDirectorsPage,
  EventDirectorRow,
  EventRow,
} from "@/app/components/types";

/**
 * Public director aggregates, computed in-page from events + reviews.
 *
 * The old `get_director_profile` RPC is gone; the new `public_directors`
 * view carries identity only. We derive the ratings/counts here from
 * PUBLIC data: non-draft events for the owner, and their PUBLISHED
 * reviews (coach vs attendee split on `reviewer_role='coach'`, matching
 * the ratings trigger). No PII — reviewer identity is never read here.
 */
export async function getDirectorProfile(
  id: string,
): Promise<DirectorProfile | null> {
  const supabase = createAnonServerClient();
  // unwrap: a query failure here must throw, not 404 a live director
  // (which also silently drops the host ContactPanel from event pages).
  const { data: d } = unwrap(
    await supabase
      .from("public_directors")
      .select(
        "id, first_name, last_name, organization_title, org_logo_url, org_description, profile_photo_url, business_phone, business_email, business_website",
      )
      .eq("id", id)
      .maybeSingle(),
    "getDirectorProfile director",
  );
  if (!d) return null;
  const dir = d as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    org_logo_url: string | null;
    org_description: string | null;
    profile_photo_url: string | null;
    business_phone: string | null;
    business_email: string | null;
    business_website: string | null;
  };

  const events = unwrapRows<{
    id: string;
    lifecycle: "draft" | "active" | "canceled";
    start_date: string | null;
    end_date: string | null;
  }>(
    await supabase
      .from("events")
      .select("id, lifecycle, start_date, end_date")
      .eq("owner_id", id)
      .neq("lifecycle", "draft"),
    "getDirectorProfile events",
  );

  let coachSum = 0,
    coachRated = 0,
    coachN = 0,
    attSum = 0,
    attRated = 0,
    attN = 0,
    guru = false;
  if (events.length) {
    const rvs = unwrapRows<{
      overall: number | null;
      reviewer_role: string | null;
      guru_review: boolean;
    }>(
      await supabase
        .from("reviews")
        .select("overall, reviewer_role, guru_review")
        .eq("status", "published")
        .in(
          "event_id",
          events.map((e) => e.id),
        ),
      "getDirectorProfile reviews",
    );
    for (const r of rvs) {
      if (r.guru_review) guru = true;
      const o = Number(r.overall ?? 0);
      if (r.reviewer_role === "coach") {
        coachN++;
        if (o > 0) {
          coachSum += o;
          coachRated++;
        }
      } else {
        attN++;
        if (o > 0) {
          attSum += o;
          attRated++;
        }
      }
    }
  }

  let completed = 0,
    open = 0;
  for (const e of events) {
    const s = deriveEventStatus(e);
    if (s === "Concluded") completed++;
    else if (s === "Upcoming" || s === "Ongoing") open++;
  }

  const name =
    dir.organization_title ||
    [dir.first_name, dir.last_name].filter(Boolean).join(" ") ||
    "Director";

  return {
    id: dir.id,
    display_name: name,
    director_name:
      [dir.first_name, dir.last_name].filter(Boolean).join(" ") || null,
    org_logo: dir.org_logo_url,
    org_description: dir.org_description,
    club_affiliation: dir.organization_title,
    profile_picture: dir.profile_photo_url,
    guru_badge: guru,
    completed_events: completed,
    open_events: open,
    total_events: events.length,
    coach_rating: coachRated ? coachSum / coachRated : 0,
    coach_reviews: coachN,
    attendee_rating: attRated ? attSum / attRated : 0,
    attendee_reviews: attN,
    business_phone: dir.business_phone,
    business_email: dir.business_email,
    business_website: dir.business_website,
  };
}

/**
 * Paginated director directory for the About "Meet our team" grid.
 * Replaces the old get_event_directors RPC — public_directors (event
 * directors only, no PII) plus per-director aggregates derived from
 * their non-draft events and PUBLISHED reviews.
 */
export async function getEventDirectors({
  page = 1,
  pageSize = 12,
}: {
  page?: number;
  pageSize?: number;
}): Promise<EventDirectorsPage> {
  // A query failure returns `source: "unavailable"` instead of throwing:
  // the About grid renders a designed "temporarily unavailable" state on
  // that marker, which beats an error boundary on a marketing page. The
  // error still reaches the server log. Empty data with source "rpc"
  // remains the true "no directors yet" state — failure and emptiness
  // must never look alike.
  try {
    return await fetchEventDirectors(page, pageSize);
  } catch (err) {
    console.error("getEventDirectors:", err);
    return { data: [], total: 0, source: "unavailable" };
  }
}

async function fetchEventDirectors(
  page: number,
  pageSize: number,
): Promise<EventDirectorsPage> {
  const supabase = createAnonServerClient();
  const from = (page - 1) * pageSize;
  const { data: dirs, count } = unwrap(
    await supabase
      .from("public_directors")
      .select("id, first_name, last_name, organization_title, org_logo_url, profile_photo_url", {
        count: "exact",
      })
      .order("organization_title", { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1),
    "getEventDirectors directors",
  );

  const rows = (dirs ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    org_logo_url: string | null;
    profile_photo_url: string | null;
  }[];
  const total = count ?? 0;
  if (rows.length === 0) return { data: [], total, source: "rpc" };

  const dirIds = rows.map((r) => r.id);
  const events = unwrapRows<{ id: string; owner_id: string | null }>(
    await supabase
      .from("events")
      .select("id, owner_id")
      .in("owner_id", dirIds)
      .neq("lifecycle", "draft"),
    "getEventDirectors events",
  );

  const eventCountByDir = new Map<string, number>();
  const eventToDir = new Map<string, string>();
  for (const e of events) {
    if (!e.owner_id) continue;
    eventCountByDir.set(e.owner_id, (eventCountByDir.get(e.owner_id) ?? 0) + 1);
    eventToDir.set(e.id, e.owner_id);
  }

  const reviewCountByDir = new Map<string, number>();
  const ratingSumByDir = new Map<string, number>();
  const ratedCountByDir = new Map<string, number>();
  if (events.length) {
    const rvs = unwrapRows(
      await supabase
        .from("reviews")
        .select("event_id, overall")
        .eq("status", "published")
        .in(
          "event_id",
          events.map((e) => e.id),
        ),
      "getEventDirectors reviews",
    );
    for (const rv of rvs) {
      if (!rv.event_id) continue;
      const dir = eventToDir.get(rv.event_id);
      if (!dir) continue;
      reviewCountByDir.set(dir, (reviewCountByDir.get(dir) ?? 0) + 1);
      const o = Number(rv.overall ?? 0);
      if (o > 0) {
        ratingSumByDir.set(dir, (ratingSumByDir.get(dir) ?? 0) + o);
        ratedCountByDir.set(dir, (ratedCountByDir.get(dir) ?? 0) + 1);
      }
    }
  }

  const data: EventDirectorRow[] = rows.map((r) => {
    const rated = ratedCountByDir.get(r.id) ?? 0;
    return {
      id: r.id,
      display_name:
        r.organization_title ||
        [r.first_name, r.last_name].filter(Boolean).join(" ") ||
        "Director",
      profile_picture: r.profile_photo_url,
      org_logo: r.org_logo_url,
      club_affiliation: r.organization_title,
      event_count: eventCountByDir.get(r.id) ?? 0,
      total_reviews: reviewCountByDir.get(r.id) ?? 0,
      avg_rating: rated ? (ratingSumByDir.get(r.id) ?? 0) / rated : 0,
    };
  });

  return { data, total, source: "rpc" };
}

/** Rows for the events grid on the public ED page (and OtherEvents). */
export async function getDirectorEventRows(
  id: string,
  opts: { excludeEventId?: string; limit?: number } = {},
): Promise<EventRow[]> {
  const supabase = createAnonServerClient();
  const { data: owner } = unwrap(
    await supabase
      .from("public_directors")
      .select("org_logo_url, profile_photo_url")
      .eq("id", id)
      .maybeSingle<{
        org_logo_url: string | null;
        profile_photo_url: string | null;
      }>(),
    "getDirectorEventRows owner",
  );
  const hostLogo = owner?.org_logo_url ?? owner?.profile_photo_url ?? null;

  let query = supabase
    .from("events")
    .select(
      "id, owner_id, title, description, host_club, logo_url, location_formatted, location_state_abbr, start_date, end_date, lifecycle, is_premium, is_general_ad, region, teams_attended_prev_year, general_rating, coach_rating, attendee_rating, review_count, created_at, event_age_groups(age, team_gender), event_competition_levels(level), event_surfaces(surface)",
    )
    .eq("owner_id", id)
    .neq("lifecycle", "draft")
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.excludeEventId) query = query.neq("id", opts.excludeEventId);
  if (opts.limit) query = query.limit(opts.limit);

  const data = unwrapRows<RawEventRow>(await query, "getDirectorEventRows events");
  return mapEventRows(data, hostLogo);
}

type RawEventRow = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  host_club: string | null;
  logo_url: string | null;
  location_formatted: string | null;
  location_state_abbr: string | null;
  start_date: string | null;
  end_date: string | null;
  lifecycle: "draft" | "active" | "canceled";
  is_premium: boolean;
  is_general_ad: boolean;
  region: string | null;
  teams_attended_prev_year: number | null;
  general_rating: number | null;
  coach_rating: number | null;
  attendee_rating: number | null;
  review_count: number;
  created_at: string;
  event_age_groups: { age: string | null; team_gender: string | null }[] | null;
  event_competition_levels: { level: string | null }[] | null;
  event_surfaces: { surface: string | null }[] | null;
};

function mapEventRows(rows: RawEventRow[], hostLogo: string | null): EventRow[] {
  return rows.map((r) => {
    const ages = Array.from(
      new Set((r.event_age_groups ?? []).map((g) => g.age).filter(Boolean)),
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
      host_logo: hostLogo,
      general_rating: r.general_rating,
      coach_rating: r.coach_rating,
      attendee_rating: r.attendee_rating,
      reviews: r.review_count,
      nr_teams_last_year: r.teams_attended_prev_year,
      created_at: r.created_at,
      region: r.region,
      event_ages: ages.map((age) => ({ age })),
      event_genders: genders.map((gender) => ({ gender })),
      event_competition_levels: levels.map((level) => ({ level })),
      event_fields: surfaces.map((surface) => ({ surface })),
    } satisfies EventRow;
  });
}
