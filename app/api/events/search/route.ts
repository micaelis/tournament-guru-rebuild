import { NextResponse, type NextRequest } from "next/server";
import {
  searchEvents,
  searchEventsPage,
  normalizeSort,
} from "@/lib/supabase/queries";

/**
 * Event search endpoint. Two modes over one route (no parallel search):
 *
 *  • Typeahead (default) — `?q=` [+ `concluded=1`]. Powers the reusable
 *    EventSearchOverlay (Write-a-Review gate, hero, Find Tournament). Returns
 *    `{ events, error }` with up to 8 lightweight rows.
 *
 *  • Paged/filtered — request includes `page`, `sort`, or any filter param.
 *    Powers the Find Events page: full filters, sort, pagination, total count
 *    and per-event coordinates via the search_events_page RPC. Returns
 *    `{ events, total, page, pageSize, source, error }`.
 */
const FILTER_KEYS = [
  "ages",
  "genders",
  "levels",
  "surfaces",
  "states",
  // "regions" retained so legacy URLs still switch into paged mode.
  "regions",
  "dateStart",
  "dateEnd",
  "open",
  "page",
  "sort",
] as const;

function list(v: string | null): string[] {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";

  const isPaged = FILTER_KEYS.some((k) => params.has(k));

  if (!isPaged) {
    const concludedOnly = params.get("concluded") === "1";
    const { data, error } = await searchEvents(q, { concludedOnly });
    if (error) {
      return NextResponse.json({ events: [], error }, { status: 500 });
    }
    return NextResponse.json({ events: data, error: null });
  }

  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    48,
    Math.max(1, parseInt(params.get("pageSize") ?? "12", 10) || 12)
  );
  const sort = normalizeSort(params.get("sort"));

  // Prefer the new "states" param; fall back to legacy "regions" (2-letter
  // codes shipped there work as US state codes 1-to-1).
  const statesRaw =
    list(params.get("states")).length > 0
      ? list(params.get("states"))
      : list(params.get("regions"));

  const { data, total, error, source } = await searchEventsPage(
    {
      q,
      ages: list(params.get("ages")),
      genders: list(params.get("genders")),
      levels: list(params.get("levels")),
      surfaces: list(params.get("surfaces")),
      states: statesRaw.map((s) => s.toUpperCase()),
      dateStart: params.get("dateStart"),
      dateEnd: params.get("dateEnd"),
      openOnly: params.get("open") === "1",
    },
    { page, pageSize, sort }
  );

  if (error) {
    return NextResponse.json(
      { events: [], total: 0, page, pageSize, source, error },
      { status: 500 }
    );
  }
  return NextResponse.json({ events: data, total, page, pageSize, source, error: null });
}
