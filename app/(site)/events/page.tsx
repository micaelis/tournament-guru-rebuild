import type { Metadata } from "next";
import { EventsSearch } from "@/app/components/events/EventsSearch";
import { parseSearchParams } from "@/app/components/events/taxonomy";
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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { filters, sort, page } = parseSearchParams(sp);

  const [search, facets, stats, claimViewer, favoritedIds] = await Promise.all([
    searchEvents(filters, { page, pageSize: PAGE_SIZE, sort }),
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
