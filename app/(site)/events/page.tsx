import type { Metadata } from "next";
import { EventsSearch } from "@/app/components/events/EventsSearch";
import { parseSearchParams } from "@/app/components/events/taxonomy";
import { searchEvents, getEventFacets } from "@/lib/events/search";
import { fetchPlatformStats } from "../queries";

const PAGE_SIZE = 12;

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

  const [search, facets, stats] = await Promise.all([
    searchEvents(filters, { page, pageSize: PAGE_SIZE, sort }),
    getEventFacets(),
    fetchPlatformStats(),
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
    />
  );
}
