import type { Metadata } from "next";
import { EventsSearch } from "@/app/components/events/EventsSearch";
import { parseSearchParams, type Filters } from "@/app/components/events/taxonomy";
import { milesForPref } from "@/lib/geo";
import { searchEvents, getEventFacets } from "@/lib/events/search";
import { createServerAuthClient } from "@/lib/supabase/server";
import type { ClaimViewer } from "@/app/components/EventCard";
import { fetchPlatformStats } from "../queries";

const PAGE_SIZE = 12;

/**
 * Who's viewing, so unclaimed search cards render the right Claim CTA:
 * anon → ED-signup, signed-in ED → claim modal, everyone else → none.
 */
async function resolveClaimViewer(): Promise<ClaimViewer> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "anon";
  const { data } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: string }>();
  return data?.user_type === "event_director" ? "ed" : "other";
}

/** The signed-in viewer's favorited event ids (empty for anon). */
async function fetchFavoritedIds(): Promise<string[]> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("favorites")
    .select("event_id")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.event_id as string);
}

export const metadata: Metadata = {
  title: "Find Events · Tournament Guru",
  description:
    "Search youth-sports tournaments by age, gender, level, surface, state, and dates — with verified coach and attendee reviews.",
};

/**
 * Pre-apply the signed-in user's saved distance preference (spec: "this
 * page should have some filters pre-applied, specifically the distance
 * from filter"). Only when the URL carries no distance verdict of its own —
 * an explicit `dist=…` (including the `dist=any` opt-out the reset chip
 * writes) always wins. Needs both a saved preference and a geocoded
 * profile location; anon users and text-only locations skip silently.
 */
async function applyProfileDistance(
  filters: Filters,
  sp: Record<string, string | string[] | undefined>,
): Promise<Filters> {
  if (sp.dist !== undefined || filters.distCleared) return filters;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return filters;
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "distance_pref, location_lat, location_lng, location_city, location_state_abbr, location_formatted",
    )
    .eq("id", user.id)
    .maybeSingle<{
      distance_pref: string | null;
      location_lat: number | null;
      location_lng: number | null;
      location_city: string | null;
      location_state_abbr: string | null;
      location_formatted: string | null;
    }>();
  const miles = milesForPref(profile?.distance_pref);
  if (
    miles == null ||
    profile?.location_lat == null ||
    profile?.location_lng == null
  ) {
    return filters;
  }
  const label =
    profile.location_city && profile.location_state_abbr
      ? `${profile.location_city}, ${profile.location_state_abbr}`
      : profile.location_formatted ?? "your location";
  return {
    ...filters,
    distMiles: miles,
    distLat: profile.location_lat,
    distLng: profile.location_lng,
    distLoc: label,
  };
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = parseSearchParams(sp);
  const { sort, page } = parsed;
  const filters = await applyProfileDistance(parsed.filters, sp);

  const [search, facets, stats, claimViewer, favoritedIds] = await Promise.all([
    searchEvents(
      {
        ...filters,
        distanceMiles: filters.distMiles,
        centerLat: filters.distLat,
        centerLng: filters.distLng,
      },
      { page, pageSize: PAGE_SIZE, sort },
    ),
    getEventFacets(),
    fetchPlatformStats(),
    resolveClaimViewer(),
    fetchFavoritedIds(),
  ]);

  return (
    <EventsSearch
      initialResults={search.data}
      initialTotal={search.total}
      facets={facets}
      initialFilters={filters}
      initialSort={sort}
      initialPage={page}
      pageSize={PAGE_SIZE}
      stats={{
        events: stats.events,
        reviews: stats.reviews,
        tournaments: stats.tournaments,
      }}
      claimViewer={claimViewer}
      favoritedIds={favoritedIds}
    />
  );
}
