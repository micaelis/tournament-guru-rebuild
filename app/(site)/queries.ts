import "server-only";
import { createAnonServerClient } from "@/lib/supabase/server";
import { legacyStatus } from "@/lib/events/status";
import type { EventRow } from "@/app/components/types";

export type PlatformStats = {
  reviews: number;
  events: number;
  tournaments: number;
};

/** Wraps get_platform_stats; falls back to zeros if the RPC fails. */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("get_platform_stats");
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return { reviews: 0, events: 0, tournaments: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    reviews: Number(row.reviews ?? 0),
    events: Number(row.events ?? 0),
    tournaments: Number(row.tournaments ?? 0),
  };
}

export type PopularSearch = { term: string; hits: number };

/**
 * Popular searches — spec says the landing shows 3 hardcoded chips.
 * We call the RPC and pad with the client's approved defaults if the
 * DB list is short (fresh install / low traffic).
 */
export async function fetchPopularSearches(): Promise<PopularSearch[]> {
  const supabase = createAnonServerClient();
  const { data } = await supabase.rpc("get_popular_searches", {
    p_limit: 6,
    p_days: 90,
  });
  const rows = (data ?? []) as PopularSearch[];
  const defaults: PopularSearch[] = [
    { term: "Youth Soccer", hits: 0 },
    { term: "U12 Girls", hits: 0 },
    { term: "Kansas City", hits: 0 },
  ];
  const merged = [...rows];
  for (const d of defaults) {
    if (!merged.some((r) => r.term.toLowerCase() === d.term.toLowerCase())) {
      merged.push(d);
    }
  }
  return merged.slice(0, 3);
}

export type FeaturedEventRow = {
  id: string;
  title: string;
  logo_url: string | null;
  host_club: string | null;
  location_formatted: string | null;
  start_date: string | null;
  end_date: string | null;
  is_premium: boolean;
  is_general_ad: boolean;
  general_rating: number | null;
  review_count: number;
  would_return_pct: number | null;
};

/**
 * Featured Events strip: premium OR general-ad + not concluded > 30
 * days ago (spec: "start > now-30d"). Soonest-first.
 */
export async function fetchFeaturedEvents(): Promise<FeaturedEventRow[]> {
  const supabase = createAnonServerClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data } = await supabase
    .from("events")
    .select(
      "id, title, logo_url, host_club, location_formatted, start_date, end_date, is_premium, is_general_ad, general_rating, review_count, would_return_pct",
    )
    .eq("lifecycle", "active")
    .or("is_premium.eq.true,is_general_ad.eq.true")
    .gte("start_date", cutoff)
    .order("start_date", { ascending: true })
    .limit(6);
  return (data ?? []) as unknown as FeaturedEventRow[];
}

/**
 * Featured Events for the landing showcase, shaped into the `EventRow`
 * design contract the restored `main` components (FeaturedShowcase)
 * expect. Premium OR sponsored, active, starting within the last 30
 * days onward, soonest-first. Enriches each row with the host org logo
 * and the coach/attendee review-count split — neither is a column on
 * `events`, so we derive them: the logo from the owner's public
 * projection, the counts from the reviews table using the same
 * `reviewer_role='coach'` split the ratings trigger uses.
 */
export async function fetchFeaturedEventRows(): Promise<EventRow[]> {
  const supabase = createAnonServerClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data } = await supabase
    .from("events")
    .select(
      "id, owner_id, title, description, host_club, logo_url, location_formatted, location_state_abbr, start_date, end_date, lifecycle, is_premium, is_general_ad, region, teams_attended_prev_year, would_return_pct, general_rating, coach_rating, attendee_rating, review_count, created_at, event_age_groups(age, team_gender)",
    )
    .eq("lifecycle", "active")
    .or("is_premium.eq.true,is_general_ad.eq.true")
    .gte("start_date", cutoff)
    .order("start_date", { ascending: true })
    .limit(4);

  type Row = {
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
    would_return_pct: number | null;
    general_rating: number | null;
    coach_rating: number | null;
    attendee_rating: number | null;
    review_count: number;
    created_at: string;
    event_age_groups: { age: string | null; team_gender: string | null }[] | null;
  };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const ownerIds = Array.from(
    new Set(rows.map((r) => r.owner_id).filter(Boolean)),
  ) as string[];

  const [{ data: owners }, { data: reviewRows }] = await Promise.all([
    ownerIds.length
      ? supabase
          .from("public_event_owners")
          .select("id, org_logo_url, profile_photo_url")
          .in("id", ownerIds)
      : Promise.resolve({ data: [] as { id: string; org_logo_url: string | null; profile_photo_url: string | null }[] }),
    supabase
      .from("reviews")
      .select("event_id, reviewer_role")
      .eq("status", "published")
      .in("event_id", ids),
  ]);

  const logoByOwner = new Map(
    ((owners ?? []) as { id: string; org_logo_url: string | null; profile_photo_url: string | null }[]).map(
      (o) => [o.id, o.org_logo_url ?? o.profile_photo_url ?? null] as const,
    ),
  );
  const coachCount = new Map<string, number>();
  const attendeeCount = new Map<string, number>();
  for (const rv of (reviewRows ?? []) as { event_id: string; reviewer_role: string | null }[]) {
    const bucket = rv.reviewer_role === "coach" ? coachCount : attendeeCount;
    bucket.set(rv.event_id, (bucket.get(rv.event_id) ?? 0) + 1);
  }

  return rows.map((r) => {
    const ages = Array.from(
      new Set((r.event_age_groups ?? []).map((g) => g.age).filter(Boolean)),
    ) as string[];
    const genders = Array.from(
      new Set((r.event_age_groups ?? []).map((g) => g.team_gender).filter(Boolean)),
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
      event_ages: ages.map((age) => ({ age })),
      event_genders: genders.map((gender) => ({ gender })),
    } satisfies EventRow;
  });
}

export type DemoReviewRow = {
  id: string;
  reviewer_name: string;
  reviewer_role: string | null;
  event_title: string | null;
  review_title: string | null;
  review_body: string | null;
  overall: number | null;
};

/** Landing testimonials — always the demo_reviews table (spec: no
 * real reviews on the marketing surface). */
export async function fetchDemoReviews(): Promise<DemoReviewRow[]> {
  const supabase = createAnonServerClient();
  const { data } = await supabase
    .from("demo_reviews")
    .select(
      "id, reviewer_name, reviewer_role, event_title, review_title, review_body, overall",
    )
    .order("sort_order", { ascending: true })
    .limit(6);
  return (data ?? []) as unknown as DemoReviewRow[];
}
