import Link from "next/link";
import type { Route } from "next";
import { createAnonServerClient } from "@/lib/supabase/server";
import {
  Button,
  Card,
  StarRating,
  StatusPill,
} from "@/app/components/ui";
import { safeImageSrc } from "@/lib/url";
import { deriveEventStatus } from "@/app/dashboard/events/event-shared";
import {
  EVENT_REGIONS,
  SURFACES,
  COMPETITION_LEVELS,
  AGE_BRACKETS,
} from "@/lib/enums";

type SearchParams = { [key: string]: string | string[] | undefined };

const SORT_OPTIONS = [
  { value: "date_asc", label: "Soonest" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "reviews_desc", label: "Most reviews" },
] as const;

/**
 * Public search events page. URL-driven filters (state[], region[],
 * surface[], level[], age[], q, sort). Every query hits the anon
 * client — RLS + column allow-lists keep sensitive columns off the
 * wire.
 *
 * Map + distance-from-me are deferred (Slice 5 follow-up). The
 * filter surface is deliberately dense on the sidebar so the
 * default view scans quickly.
 */
export default async function SearchEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const states = toArray(sp.state);
  const regions = toArray(sp.region);
  const surfaces = toArray(sp.surface);
  const levels = toArray(sp.level);
  const ages = toArray(sp.age);
  const sortRaw = typeof sp.sort === "string" ? sp.sort : "date_asc";
  const sort =
    SORT_OPTIONS.find((s) => s.value === sortRaw)?.value ?? "date_asc";

  const supabase = createAnonServerClient();

  // If any age or surface / level filter is set, we need the joined child
  // tables to filter. Do a two-step query: first find matching events by
  // child conditions, then load the base rows.
  let matchingIds: string[] | null = null;
  if (ages.length) {
    const { data } = await supabase
      .from("event_age_groups")
      .select("event_id")
      .in("age", ages);
    matchingIds = intersect(
      matchingIds,
      Array.from(new Set(((data ?? []) as { event_id: string }[]).map((r) => r.event_id))),
    );
  }
  if (surfaces.length) {
    const { data } = await supabase
      .from("event_surfaces")
      .select("event_id")
      .in("surface", surfaces);
    matchingIds = intersect(
      matchingIds,
      Array.from(new Set(((data ?? []) as { event_id: string }[]).map((r) => r.event_id))),
    );
  }
  if (levels.length) {
    const { data } = await supabase
      .from("event_competition_levels")
      .select("event_id")
      .in("level", levels);
    matchingIds = intersect(
      matchingIds,
      Array.from(new Set(((data ?? []) as { event_id: string }[]).map((r) => r.event_id))),
    );
  }

  let query = supabase
    .from("events")
    .select(
      "id, title, logo_url, host_club, location_formatted, location_state_abbr, start_date, end_date, region, lifecycle, is_premium, is_sponsored, general_rating, review_count, would_return_pct",
    )
    .eq("lifecycle", "active");
  if (states.length) query = query.in("location_state_abbr", states);
  if (regions.length) query = query.in("region", regions);
  if (q) query = query.ilike("title", `%${q}%`);
  if (matchingIds !== null) {
    if (matchingIds.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("id", matchingIds);
    }
  }

  if (sort === "date_asc") query = query.order("start_date", { ascending: true });
  if (sort === "rating_desc") query = query.order("general_rating", { ascending: false, nullsFirst: false });
  if (sort === "reviews_desc") query = query.order("review_count", { ascending: false });

  const { data } = await query.limit(60);
  const events = (data ?? []) as Array<{
    id: string;
    title: string;
    logo_url: string | null;
    host_club: string | null;
    location_formatted: string | null;
    location_state_abbr: string | null;
    start_date: string | null;
    end_date: string | null;
    region: "I" | "II" | "III" | "IV" | null;
    lifecycle: "draft" | "active" | "canceled";
    is_premium: boolean;
    is_sponsored: boolean;
    general_rating: number | null;
    review_count: number;
    would_return_pct: number | null;
  }>;

  // Log the search term — search_queries triggers rate-limit at 1000/min.
  if (q.trim()) {
    void supabase.from("search_queries").insert({ term: q.trim() });
  }

  const states50: { code: string; name: string }[] = (
    await supabase.from("us_states").select("code, name").order("name")
  ).data as { code: string; name: string }[];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Find events
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {events.length} event{events.length === 1 ? "" : "s"} match your filters.
        </p>
      </header>
      <form method="GET" className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
              Search
            </span>
            <input
              name="q"
              defaultValue={q}
              className="tg-control"
              placeholder="Tournament name…"
            />
          </label>
          <Filter
            label="State"
            name="state"
            selected={states}
            options={(states50 ?? []).map((s) => ({
              value: s.code,
              label: `${s.code} — ${s.name}`,
            }))}
          />
          <Filter
            label="Region"
            name="region"
            selected={regions}
            options={EVENT_REGIONS.map((r) => ({ value: r.value, label: r.label }))}
          />
          <Filter
            label="Surface"
            name="surface"
            selected={surfaces}
            options={SURFACES.map((s) => ({ value: s.value, label: s.label }))}
          />
          <Filter
            label="Level"
            name="level"
            selected={levels}
            options={COMPETITION_LEVELS.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Filter
            label="Age"
            name="age"
            selected={ages}
            options={AGE_BRACKETS.map((a) => ({ value: a, label: a }))}
          />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
              Sort
            </span>
            <select name="sort" defaultValue={sort} className="tg-control tg-select">
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1">
              Apply
            </Button>
            <Link href={"/events" as Route} className="flex-1">
              <Button type="button" variant="ghost" size="sm" className="w-full">
                Reset
              </Button>
            </Link>
          </div>
        </aside>
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
              Nothing matched your filters. Try broadening the search.
            </div>
          ) : (
            events.map((e) => <EventRow key={e.id} event={e} />)
          )}
        </div>
      </form>
    </main>
  );
}

function Filter({
  label,
  name,
  selected,
  options,
}: {
  label: string;
  name: string;
  selected: string[];
  options: { value: string; label: string }[];
}) {
  return (
    <details open className="rounded-xl border border-slate-100 p-3">
      <summary className="cursor-pointer text-[13px] font-semibold text-slate-800">
        {label}
      </summary>
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-[12.5px]">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                name={name}
                value={o.value}
                defaultChecked={checked}
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function EventRow({
  event,
}: {
  event: {
    id: string;
    title: string;
    logo_url: string | null;
    host_club: string | null;
    location_formatted: string | null;
    location_state_abbr: string | null;
    start_date: string | null;
    end_date: string | null;
    lifecycle: "draft" | "active" | "canceled";
    is_premium: boolean;
    is_sponsored: boolean;
    general_rating: number | null;
    review_count: number;
    would_return_pct: number | null;
  };
}) {
  const status = deriveEventStatus(event);
  const logo = safeImageSrc(event.logo_url);
  return (
    <Card className="p-4">
      <Link
        href={`/events/${event.id}` as Route}
        className="flex flex-wrap items-start gap-4"
      >
        <span className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-xl bg-slate-100">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-extrabold text-slate-500">
              {event.title[0]?.toUpperCase() ?? "T"}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <StatusPill tone={statusTone(status)}>{status}</StatusPill>
            {event.is_premium && <StatusPill tone="warning">Premium</StatusPill>}
            {event.is_sponsored && <StatusPill tone="info">Sponsored</StatusPill>}
          </div>
          <h3 className="mt-2 text-lg font-extrabold text-slate-900">
            {event.title}
          </h3>
          <p className="text-xs text-slate-500">
            {event.host_club && <>{event.host_club} · </>}
            {event.location_formatted ?? "Location TBD"}
            {" · "}
            {formatRange(event.start_date, event.end_date)}
          </p>
        </div>
        <div className="text-right">
          {event.review_count > 0 ? (
            <StarRating
              value={event.general_rating ?? 0}
              count={event.review_count}
              size={12}
            />
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              No reviews yet
            </span>
          )}
          {event.would_return_pct !== null && (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
              {event.would_return_pct.toFixed(0)}% would return
            </p>
          )}
        </div>
      </Link>
    </Card>
  );
}

function statusTone(
  s: "Draft" | "Upcoming" | "Ongoing" | "Concluded" | "Canceled",
): "draft" | "upcoming" | "ongoing" | "concluded" | "canceled" {
  return s.toLowerCase() as
    | "draft"
    | "upcoming"
    | "ongoing"
    | "concluded"
    | "canceled";
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function intersect(a: string[] | null, b: string[]): string[] {
  if (a === null) return b;
  const set = new Set(b);
  return a.filter((x) => set.has(x));
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Dates TBD";
  if (start && end && start === end) return short(start);
  return [start ? short(start) : "?", end ? short(end) : "?"].join(" – ");
}
function short(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
