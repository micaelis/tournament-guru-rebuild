import { NextResponse } from "next/server";
import { createAnonServerClient } from "@/lib/supabase/server";
import { deriveEventStatus } from "@/app/dashboard/events/event-shared";
import type { EventSearchRow } from "@/app/components/types";

/**
 * Typeahead search feeding the header EventSearchOverlay. Public,
 * read-only, anon client (RLS + column grants keep sensitive columns
 * off the wire). Returns the `EventSearchRow` shape the overlay renders
 * — the presentation is main's design; only this data source is new.
 *
 * `?q=` matches title / host club / location. `?concluded=1` narrows to
 * events that have already ended (the "write a review" flow).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const concludedOnly = searchParams.get("concluded") === "1";

  const supabase = createAnonServerClient();
  let query = supabase
    .from("events")
    .select(
      "id, title, logo_url, host_club, location_formatted, location_state_abbr, start_date, end_date, lifecycle, event_age_groups(age, team_gender)",
    )
    .eq("lifecycle", "active");

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `title.ilike.${like},host_club.ilike.${like},location_formatted.ilike.${like}`,
    );
  }
  if (concludedOnly) {
    const today = new Date().toISOString().slice(0, 10);
    query = query.lt("end_date", today);
  }

  const { data, error } = await query
    .order("start_date", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    title: string;
    logo_url: string | null;
    host_club: string | null;
    location_formatted: string | null;
    location_state_abbr: string | null;
    start_date: string | null;
    end_date: string | null;
    lifecycle: "draft" | "active" | "canceled";
    event_age_groups: { age: string | null; team_gender: string | null }[] | null;
  };

  const events: EventSearchRow[] = ((data ?? []) as Row[]).map((r) => {
    const ages = Array.from(
      new Set((r.event_age_groups ?? []).map((g) => g.age).filter(Boolean)),
    ) as string[];
    const genders = Array.from(
      new Set(
        (r.event_age_groups ?? []).map((g) => g.team_gender).filter(Boolean),
      ),
    ) as string[];
    return {
      id: r.id,
      title: r.title,
      logo: r.logo_url,
      host_club: r.host_club,
      location_text: r.location_formatted,
      state: r.location_state_abbr,
      start_date: r.start_date,
      end_date: r.end_date,
      status: deriveEventStatus(r),
      event_ages: ages.map((age) => ({ age })),
      event_genders: genders.map((gender) => ({ gender })),
    };
  });

  return NextResponse.json({ events });
}
