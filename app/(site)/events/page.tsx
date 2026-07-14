import type { Metadata } from "next";
import {
  searchEventsPage,
  getEventFacets,
  getFeaturedEvents,
  getStats,
} from "@/lib/supabase/queries";
import { parseSearchParams } from "@/app/components/events/taxonomy";
import { EventsSearch } from "@/app/components/events/EventsSearch";

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Find Events · Tournament Guru",
  description:
    "Search and filter youth soccer tournaments by age, gender, level, format, region and dates. Real reviews from the coaches and parents who actually went.",
};

/* searchParams opts this page into dynamic rendering, so results are always
   fresh and the initial HTML is server-rendered for SEO. */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { filters, sort, page } = parseSearchParams(sp);

  const [search, facetsRes, featuredRes, recommendedRes, statsRes] = await Promise.all([
    searchEventsPage(filters, { page, pageSize: PAGE_SIZE, sort }),
    getEventFacets(),
    getFeaturedEvents(), // premium-first → "Promoted"
    // Top-rated → "Recommended" strip. Kept on "rating" specifically (not the
    // default "teams") so this surface really is quality-first.
    searchEventsPage({}, { page: 1, pageSize: 6, sort: "rating" }),
    getStats(),
  ]);

  return (
    <EventsSearch
      initialResults={search.data}
      initialTotal={search.total}
      facets={facetsRes.data}
      initialFilters={filters}
      initialSort={sort}
      initialPage={page}
      pageSize={PAGE_SIZE}
      promo={{
        recommended: recommendedRes.data,
        promoted: featuredRes.data,
      }}
      stats={{
        events: statsRes.data.eventsCount,
        reviews: statsRes.data.reviewsCount,
        tournaments: statsRes.data.tournamentsCount,
      }}
    />
  );
}
