import "server-only";
import { createAnonServerClient } from "@/lib/supabase/server";

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
  is_sponsored: boolean;
  general_rating: number | null;
  review_count: number;
  would_return_pct: number | null;
};

/**
 * Featured Events strip: premium OR sponsored + not concluded > 30
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
      "id, title, logo_url, host_club, location_formatted, start_date, end_date, is_premium, is_sponsored, general_rating, review_count, would_return_pct",
    )
    .eq("lifecycle", "active")
    .or("is_premium.eq.true,is_sponsored.eq.true")
    .gte("start_date", cutoff)
    .order("start_date", { ascending: true })
    .limit(6);
  return (data ?? []) as unknown as FeaturedEventRow[];
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
