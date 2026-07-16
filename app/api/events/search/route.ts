import { NextResponse } from "next/server";
import { searchEvents, type SearchFilters } from "@/lib/events/search";
import type { EventSort } from "@/app/components/types";

/**
 * Public event search. Feeds both the Find Events client (EventsSearch —
 * full EventRow cards + total for pagination) and the header
 * EventSearchOverlay (typeahead; `?concluded=1` narrows to ended events
 * for the review flow). Read-only, anon client — the new-schema search
 * lives in lib/events/search; the presentation is main's design.
 */
const csv = (v: string | null) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const VALID_SORTS: EventSort[] = ["recommended", "date", "rating", "teams"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const concludedOnly = searchParams.get("concluded") === "1";

  // Distance is all-or-nothing (miles + valid center) — mirrors taxonomy's
  // parseSearchParams so the URL, the page, and this API agree.
  const miles = parseInt(searchParams.get("dist") ?? "", 10);
  const lat = Number.parseFloat(searchParams.get("lat") ?? "");
  const lng = Number.parseFloat(searchParams.get("lng") ?? "");
  const distOk =
    [150, 300, 450].includes(miles) &&
    Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180;

  const filters: SearchFilters = {
    q: searchParams.get("q") ?? "",
    ages: csv(searchParams.get("ages")),
    genders: csv(searchParams.get("genders")),
    levels: csv(searchParams.get("levels")),
    surfaces: csv(searchParams.get("surfaces")),
    states: csv(searchParams.get("states")).map((s) => s.toUpperCase()),
    dateStart: searchParams.get("dateStart") || null,
    dateEnd: searchParams.get("dateEnd") || null,
    openOnly: searchParams.get("open") === "1",
    concludedOnly,
    distanceMiles: distOk ? miles : null,
    centerLat: distOk ? lat : null,
    centerLng: distOk ? lng : null,
  };

  const sortRaw = searchParams.get("sort");
  const sort: EventSort =
    sortRaw && VALID_SORTS.includes(sortRaw as EventSort) && sortRaw !== "recommended"
      ? (sortRaw as EventSort)
      : "teams";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  // Overlay asks for a short typeahead list; the full page paginates.
  const pageSize = concludedOnly
    ? 8
    : Math.min(48, Math.max(1, parseInt(searchParams.get("pageSize") ?? "12", 10) || 12));

  try {
    const { data, total } = await searchEvents(filters, { page, pageSize, sort });
    return NextResponse.json({ events: data, total });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
