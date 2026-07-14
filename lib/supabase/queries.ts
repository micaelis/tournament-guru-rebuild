import { createServerClient } from "./server";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Order events by nearest start_date first. Nulls sink to the bottom so a
 *  row without a date never leads the Featured strip. */
function sortBySoonest<T extends { start_date: string | null }>(arr: T[]): T[] {
  const INF = Number.POSITIVE_INFINITY;
  return [...arr].sort((a, b) => {
    const ta = a.start_date ? new Date(a.start_date).getTime() : INF;
    const tb = b.start_date ? new Date(b.start_date).getTime() : INF;
    return ta - tb;
  });
}

/* ─── Row shapes ─── */

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  host_club: string | null;
  location_text: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  premium: boolean;
  logo: string | null;
  /** Owner (host organisation) profile id — used to route to the org's
   *  public page from event cards. Nullable because a few unclaimed events
   *  have no owner in the seed data. */
  owner_id?: string | null;
  // Organisation logo of the event owner, resolved via the
  // `event_host_logos` SECURITY DEFINER view (profiles RLS stays locked).
  host_logo?: string | null;
  general_rating: number | null;
  coach_rating?: number | null;
  attendee_rating?: number | null;
  reviews: number | null;
  // Per-type published review counts, attached via the `get_event_review_counts`
  // RPC (same coach/attendee split as recalc_event_ratings). Undefined when the
  // RPC isn't deployed yet.
  coach_reviews?: number | null;
  attendee_reviews?: number | null;
  nr_teams_last_year?: number | null;
  created_at: string;
  // region code (I–IV) + resolved map coordinates. `lat`/`lng` come from the
  // PostGIS `location` point and are mostly NULL until geocoding runs — the
  // search map plots only the events that have them.
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
  // joined
  event_ages?: { age: string }[];
  event_competition_levels?: { level: string }[];
  event_fields?: { surface: string }[];
  event_genders?: { gender: string }[];
};

export type ReviewAuthor = {
  user_type: string | null;
  attendee_type: string | null;
};

export type ReviewRow = {
  id: string;
  review_title: string | null;
  review_body: string | null;
  overall_rating: number | null;
  username: string | null;
  user_role: string | null;
  guru_review: boolean | null;
  created_at: string;
  author_id?: string | null;
  events?: { title: string | null } | { title: string | null }[] | null;
  // Author profile badge fields — the badge (Parent / Coach / Team Manager /
  // Event Director) is derived from this, not from any field on the review.
  // Resolved via the `review_author_badges` SECURITY DEFINER view.
  author?: ReviewAuthor | ReviewAuthor[] | null;
};

/* ─── Shared select fragments ─── */

const EVENT_SELECT = `
  id, title, description, owner_id, host_club, location_text, state, region,
  start_date, end_date, status, premium, logo,
  general_rating, coach_rating, attendee_rating, reviews, nr_teams_last_year, created_at,
  event_ages ( age ),
  event_competition_levels ( level ),
  event_fields ( surface ),
  event_genders ( gender )
`;

/* ─── Featured events ─── */

/**
 * Defensive guard for the homepage Featured strip. Every card there is a paid,
 * equal-weight placement, so an obviously-incomplete or test row (e.g. a "Test
 * event" with placeholder art and no real dates) must never surface. Drops rows
 * with a placeholder-looking title or a missing start date. Applied at the
 * query so the `limit` is taken *after* the exclusion. Kept intentionally tight
 * (exact, case-insensitive title matches) to avoid ever hiding a real paid event.
 */
const PLACEHOLDER_TITLES = [
  "test event",
  "test",
  "demo",
  "sample",
  "placeholder",
  "untitled",
];

function excludePlaceholderEvents<
  T extends { not(column: string, operator: string, value: unknown): T }
>(q: T): T {
  let out = q.not("start_date", "is", null);
  for (const title of PLACEHOLDER_TITLES) {
    out = out.not("title", "ilike", title);
  }
  return out;
}

/**
 * Attach per-type review counts (coach vs attendee) via the
 * `get_event_review_counts` RPC — the same split recalc_event_ratings() uses,
 * so the counts line up exactly with coach_rating / attendee_rating. If the RPC
 * isn't deployed yet, events are returned unchanged and the cards fall back to
 * showing the overall total only.
 */
async function attachReviewCounts(
  sb: ReturnType<typeof createServerClient>,
  events: EventRow[]
): Promise<EventRow[]> {
  const ids = events.map((e) => e.id);
  if (ids.length === 0) return events;

  try {
    const { data, error } = await sb.rpc("get_event_review_counts", {
      p_event_ids: ids,
    });
    if (error || !data) return events;

    const byId = new Map(
      (
        data as {
          event_id: string;
          coach_reviews: number;
          attendee_reviews: number;
        }[]
      ).map((r) => [r.event_id, r])
    );
    for (const e of events) {
      const c = byId.get(e.id);
      e.coach_reviews = c ? Number(c.coach_reviews) : 0;
      e.attendee_reviews = c ? Number(c.attendee_reviews) : 0;
    }
  } catch {
    // RPC not deployed / transient error — leave counts undefined.
  }
  return events;
}

export async function getFeaturedEvents(): Promise<{
  data: EventRow[];
  error: string | null;
}> {
  try {
    const sb = createServerClient();

    // Premium events first, ordered by when they went featured (premium_at),
    // most-recently-featured first. The migration backfills premium_at from
    // updated_at, so it's non-null for every premium row; updated_at is a
    // defensive tiebreak. If the column isn't deployed yet we retry ordering by
    // updated_at alone so the strip degrades gracefully instead of erroring.
    const premiumQuery = (primary: "premium_at" | "updated_at") => {
      let q = excludePlaceholderEvents(
        sb
          .from("events")
          .select(EVENT_SELECT)
          .eq("premium", true)
          .neq("status", "draft")
          .or(recencyOrFilter())
      ).order(primary, { ascending: false, nullsFirst: false });
      if (primary === "premium_at") {
        q = q.order("updated_at", { ascending: false, nullsFirst: false });
      }
      return q.limit(20);
    };

    let { data: premium, error: err1 } = await premiumQuery("premium_at");
    if (err1 && /premium_at/i.test(err1.message)) {
      ({ data: premium, error: err1 } = await premiumQuery("updated_at"));
    }

    if (err1) return { data: [], error: err1.message };

    // Random selection, soonest-first ordering — per Franco's brief for
    // the Featured strip on landing + attendees:
    //  1. shuffle the eligible pool of ≤20 premium events
    //  2. slice the first 4 (so each page load yields a fresh 4)
    //  3. sort THOSE 4 by nearest start_date ascending, so the most
    //     urgent event visually leads.
    // Undated rows sort last so a stray null date never leads the strip.
    if (premium && premium.length >= 4) {
      const picked = shuffle(premium as EventRow[]).slice(0, 4);
      const enriched = await attachReviewCounts(
        sb,
        await attachHostLogos(sb, picked)
      );
      return { data: sortBySoonest(enriched), error: null };
    }

    const existing = (premium ?? []) as EventRow[];
    const existingIds = existing.map((e) => e.id);
    const remaining = 4 - existing.length;

    const query = excludePlaceholderEvents(
      sb
        .from("events")
        .select(EVENT_SELECT)
        .neq("status", "draft")
        .or(recencyOrFilter())
    )
      .order("general_rating", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(remaining);

    if (existingIds.length > 0) {
      query.not("id", "in", `(${existingIds.join(",")})`);
    }

    const { data: fallback, error: err2 } = await query;
    if (err2) return { data: sortBySoonest(existing), error: err2.message };

    const picked = shuffle([...existing, ...((fallback ?? []) as EventRow[])]).slice(0, 4);
    const enriched = await attachReviewCounts(
      sb,
      await attachHostLogos(sb, picked)
    );
    return { data: sortBySoonest(enriched), error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/* ─── Popular searches (hero "Popular" chips) ─── */

/**
 * Top submitted search terms, via the `get_popular_searches` RPC (see migration
 * 20240101000012). Returns [] on any error or if the RPC/table isn't deployed
 * yet — the hero then falls back to its curated default chips.
 */
export async function getPopularSearches(limit = 3): Promise<string[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb.rpc("get_popular_searches", {
      p_limit: limit,
      p_days: 120,
    });
    if (error || !data) return [];
    return (data as { term: string }[])
      .map((r) => r.term)
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/* ─── Dashboard: events management ─── */

export type DashboardEventRow = EventRow & {
  updated_at?: string | null;
  registration_deadline?: string | null;
};

/**
 * Events for the /dashboard/events management page.
 * ED sees only events they own; Admin sees all. RLS enforces the same
 * partition — the `ownerId` filter here is a UX affordance, not a security
 * boundary. Pass `null` to fetch everything (Admin path).
 *
 * Returns the most recently updated events first so freshly-touched work
 * is at the top of the manager's table.
 */
export async function getDashboardEvents({
  ownerId,
  limit = 200,
}: {
  ownerId: string | null;
  limit?: number;
}): Promise<{ data: DashboardEventRow[]; error: string | null }> {
  try {
    // Use the auth-aware client so profiles / owner_id checks resolve with
    // the actual signed-in session (RLS wants auth.uid()).
    const { createServerAuthClient } = await import("./server");
    const sb = await createServerAuthClient();

    let query = sb
      .from("events")
      .select(
        `
        id, title, description, owner_id, host_club, location_text, state, region,
        start_date, end_date, registration_deadline, status, premium, logo,
        general_rating, coach_rating, attendee_rating, reviews, nr_teams_last_year,
        created_at, updated_at,
        event_ages ( age ),
        event_competition_levels ( level ),
        event_fields ( surface ),
        event_genders ( gender )
      `,
      )
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (ownerId) query = query.eq("owner_id", ownerId);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as DashboardEventRow[], error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/* ─── Dashboard: reviews management ─── */

export type DashboardReviewRow = {
  id: string;
  event_id: string | null;
  event_owner_id: string | null;
  event_title: string | null;
  username: string | null;
  user_role: string | null;
  review_title: string | null;
  review_body: string | null;
  overall_rating: number | null;
  published: boolean;
  guru_review: boolean | null;
  flagged: boolean | null;
  created_at: string;
};

/**
 * Reviews for the /dashboard/reviews page.
 * ED sees reviews where event_owner_id = their id; Admin sees everything.
 * RLS mirrors this (reviews public read for published + author for own),
 * but ED viewership of drafts on their events is expected — the events
 * they own can carry unpublished reviews they still want to see.
 *
 * Returns the newest first, capped to `limit` (default 200). Bump when
 * pagination gets built.
 */
export async function getDashboardReviews({
  ownerId,
  limit = 200,
}: {
  ownerId: string | null;
  limit?: number;
}): Promise<{ data: DashboardReviewRow[]; error: string | null }> {
  try {
    const { createServerAuthClient } = await import("./server");
    const sb = await createServerAuthClient();

    let query = sb
      .from("reviews")
      .select(
        `
        id, event_id, event_owner_id,
        username, user_role,
        review_title, review_body, overall_rating,
        published, guru_review, flagged, created_at,
        events:event_id ( title )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (ownerId) query = query.eq("event_owner_id", ownerId);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    type Raw = Omit<DashboardReviewRow, "event_title"> & {
      events: { title: string | null } | { title: string | null }[] | null;
    };
    const rows: DashboardReviewRow[] = ((data ?? []) as Raw[]).map((r) => {
      const { events, ...rest } = r;
      const event_title = Array.isArray(events)
        ? events[0]?.title ?? null
        : events?.title ?? null;
      return { ...rest, event_title };
    });
    return { data: rows, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/* ─── Recent events (For Attendees / homepage "Recent Events") ─── */

/**
 * Attach each event's owner organisation logo via the `event_host_logos`
 * SECURITY DEFINER view (keeps profiles RLS locked). If the view isn't present
 * yet, events are returned unchanged and cards fall back to the host initials.
 */
async function attachHostLogos(
  sb: ReturnType<typeof createServerClient>,
  events: EventRow[]
): Promise<EventRow[]> {
  const ids = events.map((e) => e.id);
  if (ids.length === 0) return events;

  const { data: logos } = await sb
    .from("event_host_logos")
    .select("event_id, org_logo")
    .in("event_id", ids);

  if (logos) {
    const byId = new Map(
      logos.map((l) => [l.event_id as string, l.org_logo as string | null])
    );
    for (const e of events) e.host_logo = byId.get(e.id) ?? null;
  }
  return events;
}

export async function getRecentEvents(limit = 4): Promise<{
  data: EventRow[];
  error: string | null;
}> {
  try {
    const sb = createServerClient();

    // Non-draft events, most recently created first. Premium bubbles up via a
    // secondary sort so a promoted event still leads when dates tie.
    const { data, error } = await sb
      .from("events")
      .select(EVENT_SELECT)
      .neq("status", "draft")
      .or(recencyOrFilter())
      .order("premium", { ascending: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: [], error: error.message };
    const events = await attachHostLogos(sb, (data ?? []) as EventRow[]);
    return { data: events, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/* ─── Event typeahead search (reusable search overlay) ─── */

export type EventSearchRow = {
  id: string;
  title: string;
  host_club: string | null;
  location_text: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  logo: string | null;
  event_ages?: { age: string }[];
  event_genders?: { gender: string }[];
};

const EVENT_SEARCH_SELECT = `
  id, title, host_club, location_text, state,
  start_date, end_date, status, logo,
  event_ages ( age ),
  event_genders ( gender )
`;

/**
 * Free-text event search across title, host club and location. Draft events
 * are excluded (RLS also enforces this). Empty query returns the most recent
 * non-draft events so the overlay has something to show before the user types.
 */
export async function searchEvents(
  q: string,
  { limit = 8, concludedOnly = false }: { limit?: number; concludedOnly?: boolean } = {}
): Promise<{ data: EventSearchRow[]; error: string | null }> {
  try {
    const sb = createServerClient();
    const term = q.trim();

    let query = sb
      .from("events")
      .select(EVENT_SEARCH_SELECT)
      .neq("status", "draft");

    // Reviews may only be written for events that have already happened.
    // Reviewable = status 'concluded' OR the end date is in the past. Canceled
    // events are never reviewable.
    if (concludedOnly) {
      const today = new Date().toISOString().slice(0, 10);
      query = query
        .neq("status", "canceled")
        .or(`status.eq.concluded,end_date.lt.${today}`);
    }

    if (term) {
      // Escape PostgREST reserved characters in the ilike pattern.
      const safe = term.replace(/[%,()]/g, " ");
      query = query.or(
        `title.ilike.%${safe}%,host_club.ilike.%${safe}%,location_text.ilike.%${safe}%,state.ilike.%${safe}%`
      );
    }

    const { data, error } = await query
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as EventSearchRow[], error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/* ─── Find Events page: paged, filtered, ranked search ─── */

export type EventSort = "recommended" | "date" | "rating" | "teams";

export type EventSearchFilters = {
  q?: string;
  ages?: string[];
  genders?: string[];
  levels?: string[];
  surfaces?: string[];
  /** 2-letter US state codes ("CA", "NY", …). Replaces the earlier
   *  region-code filter. */
  states?: string[];
  dateStart?: string | null;
  dateEnd?: string | null;
  openOnly?: boolean;
};

export type EventSearchPage = {
  data: EventRow[];
  total: number;
  error: string | null;
  /** "rpc" = elastic search RPC; "fallback" = degraded PostgREST path (the
   *  search_events_page migration isn't applied yet). Surfaced so callers can
   *  tell when full-fidelity filtering/geo isn't available. */
  source: "rpc" | "fallback";
};

const PAGE_SORTS: EventSort[] = ["teams", "date", "rating", "recommended"];
/** Default sort for the Find Events page is now "teams" (Most teams) —
 *  Franco explicitly asked to drop "Recommended" from the dropdown. The type
 *  still accepts "recommended" so legacy bookmarks don't break; they map to
 *  the default at parse time. */
export function normalizeSort(v: string | null | undefined): EventSort {
  if (v === "recommended") return "teams";
  return PAGE_SORTS.includes(v as EventSort) ? (v as EventSort) : "teams";
}

function arr(a?: string[]): string[] | null {
  return a && a.length ? a : null;
}

/**
 * Visibility rule: only show FUTURE events, or events that concluded at most 28
 * days ago. An event's "effective end" is end_date, or start_date when end_date
 * is null; events with no dates at all are kept. Returned as a PostgREST `.or()`
 * filter string for the JS query paths (the RPC enforces the same rule in SQL).
 */
export function recencyOrFilter(): string {
  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return `end_date.gte.${cutoff},and(end_date.is.null,start_date.gte.${cutoff}),and(end_date.is.null,start_date.is.null)`;
}

/** Shape an RPC row (flat, with text[] tag arrays + lat/lng) into an EventRow
 *  so the existing EventCard consumes it unchanged. */
type RpcRow = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  host_club: string | null;
  location_text: string | null;
  state: string | null;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  premium: boolean;
  logo: string | null;
  host_logo: string | null;
  general_rating: number | null;
  reviews: number | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  teams: number | null;
  ages: string[] | null;
  genders: string[] | null;
  levels: string[] | null;
  surfaces: string[] | null;
  total_count: number | string | null;
};

function rpcRowToEvent(r: RpcRow): EventRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    owner_id: r.owner_id,
    host_club: r.host_club,
    location_text: r.location_text,
    state: r.state,
    region: r.region,
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status,
    premium: r.premium,
    logo: r.logo,
    host_logo: r.host_logo,
    general_rating: r.general_rating,
    reviews: r.reviews,
    nr_teams_last_year: r.teams,
    created_at: r.created_at,
    lat: r.lat,
    lng: r.lng,
    event_ages: (r.ages ?? []).map((age) => ({ age })),
    event_genders: (r.genders ?? []).map((gender) => ({ gender })),
    event_competition_levels: (r.levels ?? []).map((level) => ({ level })),
    event_fields: (r.surfaces ?? []).map((surface) => ({ surface })),
  };
}

/**
 * The single canonical search for the Find Events page. Calls the
 * `search_events_page` RPC (elastic tsvector + trigram keyword match, all
 * filters, sort, pagination, total count, and per-event lat/lng). If that RPC
 * isn't present yet (migration 000007 not applied), it degrades to a PostgREST
 * query that still returns a correct, paged, counted result set — keyword +
 * region + dates + open-only + sort — so the page never breaks. The degraded
 * path can't apply the age/gender/level/surface join filters or return
 * coordinates; `source: "fallback"` signals that.
 */
export async function searchEventsPage(
  filters: EventSearchFilters,
  {
    page = 1,
    pageSize = 12,
    sort = "teams",
  }: { page?: number; pageSize?: number; sort?: EventSort } = {}
): Promise<EventSearchPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const offset = (safePage - 1) * pageSize;

  try {
    const sb = createServerClient();

    // p_states is the new signature (migration 000016). Until that migration
    // is applied the RPC call errors and we fall through to the PostgREST
    // fallback below — same filters, uses events.state directly.
    const { data, error } = await sb.rpc("search_events_page", {
      p_q: filters.q?.trim() || null,
      p_ages: arr(filters.ages),
      p_genders: arr(filters.genders),
      p_levels: arr(filters.levels),
      p_surfaces: arr(filters.surfaces),
      p_states: arr(filters.states),
      p_date_start: filters.dateStart || null,
      p_date_end: filters.dateEnd || null,
      p_open_only: !!filters.openOnly,
      p_sort: sort,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (!error) {
      const rows = (data ?? []) as RpcRow[];
      const total = rows.length ? Number(rows[0].total_count ?? 0) : 0;
      return { data: rows.map(rpcRowToEvent), total, error: null, source: "rpc" };
    }
    // RPC errored (most commonly: not deployed yet) — fall through to degraded.
  } catch {
    // fall through
  }

  return searchEventsFallback(filters, { pageSize, offset, sort });
}

/** Degraded search when the RPC is unavailable. Keeps the page functional. */
async function searchEventsFallback(
  filters: EventSearchFilters,
  { pageSize, offset, sort }: { pageSize: number; offset: number; sort: EventSort }
): Promise<EventSearchPage> {
  try {
    const sb = createServerClient();
    let query = sb
      .from("events")
      .select(EVENT_SELECT, { count: "exact" })
      .neq("status", "draft")
      .or(recencyOrFilter());

    const term = filters.q?.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, " ");
      query = query.or(
        `title.ilike.%${safe}%,host_club.ilike.%${safe}%,location_text.ilike.%${safe}%,state.ilike.%${safe}%`
      );
    }
    if (filters.states?.length)
      query = query.in("state", filters.states.map((s) => s.toUpperCase()));
    if (filters.openOnly) query = query.eq("status", "open");
    if (filters.dateStart) query = query.gte("end_date", filters.dateStart);
    if (filters.dateEnd) query = query.lte("start_date", filters.dateEnd);

    // Featured (premium) always leads, then the chosen sort — mirrors the RPC.
    query = query.order("premium", { ascending: false });
    if (sort === "date") {
      query = query.order("start_date", { ascending: true, nullsFirst: false });
    } else if (sort === "rating") {
      query = query.order("general_rating", { ascending: false, nullsFirst: false });
    } else if (sort === "teams") {
      query = query.order("nr_teams_last_year", { ascending: false, nullsFirst: false });
    } else {
      query = query
        .order("general_rating", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) return { data: [], total: 0, error: error.message, source: "fallback" };

    const events = await attachHostLogos(sb, (data ?? []) as EventRow[]);
    return { data: events, total: count ?? 0, error: null, source: "fallback" };
  } catch (e) {
    return {
      data: [],
      total: 0,
      error: e instanceof Error ? e.message : "Request failed",
      source: "fallback",
    };
  }
}

/* ─── Filter facets (real values in use) ─── */

export type EventFacets = {
  ages: string[];
  genders: string[];
  levels: string[];
  surfaces: string[];
  /** 2-letter US state codes present on non-draft events. */
  states: string[];
};

/**
 * Distinct filter values actually present in public events, so the filter UI
 * is populated from real data rather than a hardcoded list. Falls back to the
 * full enum domains if the `get_event_facets` RPC isn't deployed yet, so the
 * filters are never empty.
 */
export async function getEventFacets(): Promise<{
  data: EventFacets;
  error: string | null;
}> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb.rpc("get_event_facets");
    if (error || !data) return { data: FULL_ENUM_FACETS, error: error?.message ?? null };
    // The new RPC (migration 000016) returns `states`. The pre-migration RPC
    // returned `regions` — read whichever is present so the app keeps working
    // during rollout.
    const f = data as Partial<EventFacets> & { regions?: string[] };
    const states =
      f.states && f.states.length ? f.states : (f.regions ?? []);
    return {
      data: {
        ages: f.ages ?? [],
        genders: f.genders ?? [],
        levels: f.levels ?? [],
        surfaces: f.surfaces ?? [],
        states,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: FULL_ENUM_FACETS,
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/** Full enum domains — the fallback so filters always have options. `states`
 *  falls back to an empty list here; the client taxonomy hard-codes all 50 US
 *  states as canonical options so the checkbox list is always populated. */
const FULL_ENUM_FACETS: EventFacets = {
  ages: ["u4","u5","u6","u7","u8","u9","u10","u11","u12","u13","u14","u15","u16","u17","u18","u19","u20"],
  genders: ["both", "boys", "girls"],
  levels: ["highest", "upper", "middle", "lower", "lowest"],
  surfaces: ["turf", "grass"],
  states: [],
};

/* ─── Stats band ─── */

export async function getStats(): Promise<{
  data: { eventsCount: number; reviewsCount: number; tournamentsCount: number };
  error: string | null;
}> {
  try {
    const sb = createServerClient();

    const [eventsRes, reviewsRes, tournamentsRes] = await Promise.all([
      sb
        .from("events")
        .select("id", { count: "exact", head: true })
        .neq("status", "draft"),
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("published", true),
      // "Tournaments" = distinct tournament series behind the live events.
      // The event_profiles table isn't populated yet, so derive the count from
      // the events' grouping key rather than a (currently empty) head-count.
      sb.from("events").select("event_profile_id").neq("status", "draft"),
    ]);

    const anyError =
      eventsRes.error?.message ||
      reviewsRes.error?.message ||
      tournamentsRes.error?.message ||
      null;

    const tournamentsCount = new Set(
      (tournamentsRes.data ?? [])
        .map((r) => r.event_profile_id)
        .filter((v) => v != null)
    ).size;

    return {
      data: {
        eventsCount: eventsRes.count ?? 0,
        reviewsCount: reviewsRes.count ?? 0,
        tournamentsCount,
      },
      error: anyError,
    };
  } catch (e) {
    return {
      data: { eventsCount: 0, reviewsCount: 0, tournamentsCount: 0 },
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/* ─── Recent reviews ─── */

export async function getRecentReviews(limit = 4): Promise<{
  data: ReviewRow[];
  error: string | null;
}> {
  try {
    const sb = createServerClient();

    const { data, error } = await sb
      .from("reviews")
      .select(
        `
        id, review_title, review_body, overall_rating,
        username, user_role, guru_review, created_at, author_id,
        events:event_id ( title )
      `
      )
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: [], error: error.message };
    const reviews = (data ?? []) as ReviewRow[];

    // Resolve each author's badge fields via the SECURITY DEFINER view (keeps
    // profiles RLS locked). If the view isn't present yet, we leave `author`
    // unset and the UI falls back to the "Attendee" badge — never blank.
    const authorIds = [
      ...new Set(reviews.map((r) => r.author_id).filter(Boolean)),
    ] as string[];

    if (authorIds.length > 0) {
      const { data: badges } = await sb
        .from("review_author_badges")
        .select("id, user_type, attendee_type")
        .in("id", authorIds);

      if (badges) {
        const byId = new Map(
          badges.map((b) => [
            b.id as string,
            { user_type: b.user_type, attendee_type: b.attendee_type } as ReviewAuthor,
          ])
        );
        for (const r of reviews) {
          r.author = r.author_id ? byId.get(r.author_id) ?? null : null;
        }
      }
    }

    return { data: reviews, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/* ─── FAQ ─── */

export type FaqRow = {
  id: string;
  title: string;
  content: string | null;
  sort: number | null;
};

/**
 * Canonical advertiser FAQ content (the reference set). Used to seed the
 * `faqs` table (see supabase/migrations) and as the render-time fallback so
 * the FAQ page always has content even before the table is granted/seeded.
 */
export const ADVERTISER_FAQS: { title: string; content: string }[] = [
  {
    title: "Who can advertise on your platform?",
    content:
      "Any registered business or individual offering a product or service relevant to our audience is welcome to apply.",
  },
  {
    title: "How do I get started?",
    content:
      "Simply register your company and fill out our contact form. We'll reach out to you to discuss the details and next steps.",
  },
  {
    title: "Can you help with ad design?",
    content:
      "Yes! If you don't have a ready-made banner, our design team can create one for you based on the information you provide.",
  },
  {
    title: "What ad formats do you support?",
    content:
      "We currently support static horizontal banners, with a word limit and minimum resolution (e.g. 720px wide). Full specifications will be shared during setup.",
  },
  {
    title: "How long will my ad be shown?",
    content:
      "The duration depends on the agreement — we offer flexible packages from short-term promos to long-running campaigns.",
  },
  {
    title: "Can I choose where my ad appears?",
    content:
      "Absolutely. We'll work with you to place your ad in the most relevant sections of the app — ensuring it reaches the right audience at the right time.",
  },
  {
    title: "Can I see how my ad is performing?",
    content:
      "Yes — you'll get access to a dashboard with live metrics: impressions, clicks, likes, and more. We also send you weekly performance reports.",
  },
];

/**
 * FAQs ordered by `sort`. Reads the `faqs` table; on error or empty result
 * (e.g. the table isn't granted/seeded yet) it falls back to ADVERTISER_FAQS
 * so the page always renders. `source` tells the caller which was used.
 */
export async function getFaqs(): Promise<{
  data: FaqRow[];
  error: string | null;
  source: "db" | "fallback";
}> {
  const fallback: FaqRow[] = ADVERTISER_FAQS.map((f, i) => ({
    id: `fallback-${i}`,
    title: f.title,
    content: f.content,
    sort: i,
  }));

  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("faqs")
      .select("id, title, content, sort")
      .order("sort", { ascending: true });

    if (error) return { data: fallback, error: error.message, source: "fallback" };
    if (!data || data.length === 0) {
      return { data: fallback, error: null, source: "fallback" };
    }
    return { data: data as FaqRow[], error: null, source: "db" };
  } catch (e) {
    return {
      data: fallback,
      error: e instanceof Error ? e.message : "Request failed",
      source: "fallback",
    };
  }
}

/* ─── Event directors directory (About Us · Meet Our Team) ─── */

export type EventDirectorRow = {
  id: string;
  display_name: string;
  contact_email: string | null;
  profile_picture: string | null;
  org_logo: string | null;
  club_affiliation: string | null;
  event_count: number;
  total_reviews: number;
  avg_rating: number;
};

/** Full public profile for the /directors/[id] page. Everything comes from
 *  the get_director_profile RPC — pre-aggregated so the page is one round
 *  trip. */
export type DirectorProfile = {
  id: string;
  display_name: string;
  org_logo: string | null;
  org_description: string | null;
  club_affiliation: string | null;
  profile_picture: string | null;
  guru_badge: boolean;
  completed_events: number;
  open_events: number;
  total_events: number;
  coach_rating: number;
  coach_reviews: number;
  attendee_rating: number;
  attendee_reviews: number;
};

/** Fetch the public director profile. Returns null when the RPC can't
 *  find them (deleted, not a director/admin, or the migration isn't
 *  applied). */
export async function getDirectorProfile(
  id: string,
): Promise<DirectorProfile | null> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb.rpc("get_director_profile", { p_id: id });
    if (error || !data) return null;
    return data as DirectorProfile;
  } catch {
    return null;
  }
}

/** Events hosted by a director. Uses the same EVENT_SELECT + host-logo
 *  attachment as the search page so cards render identically. */
export async function getDirectorEvents(
  ownerId: string,
): Promise<{ data: EventRow[]; error: string | null }> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("events")
      .select(EVENT_SELECT)
      .eq("owner_id", ownerId)
      .neq("status", "draft")
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    const events = await attachHostLogos(sb, (data ?? []) as EventRow[]);
    return { data: events, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

export type DirectorReviewRow = {
  id: string;
  review_title: string | null;
  review_body: string | null;
  overall_rating: number | null;
  username: string | null;
  user_role: string | null;
  guru_review: boolean | null;
  created_at: string;
  event_id: string | null;
  event_title: string | null;
};

/** Reviews for all events hosted by a director. Published only. */
export async function getDirectorReviews(
  ownerId: string,
  limit = 30,
): Promise<{ data: DirectorReviewRow[]; error: string | null }> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("reviews")
      .select(
        `
        id, review_title, review_body, overall_rating,
        username, user_role, guru_review, created_at,
        event_id, events:event_id ( title )
      `,
      )
      .eq("event_owner_id", ownerId)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    type RawRow = {
      id: string;
      review_title: string | null;
      review_body: string | null;
      overall_rating: number | null;
      username: string | null;
      user_role: string | null;
      guru_review: boolean | null;
      created_at: string;
      event_id: string | null;
      events: { title: string | null } | { title: string | null }[] | null;
    };
    const rows: DirectorReviewRow[] = ((data ?? []) as RawRow[]).map((r) => ({
      id: r.id,
      review_title: r.review_title,
      review_body: r.review_body,
      overall_rating: r.overall_rating,
      username: r.username,
      user_role: r.user_role,
      guru_review: r.guru_review,
      created_at: r.created_at,
      event_id: r.event_id,
      event_title: Array.isArray(r.events)
        ? r.events[0]?.title ?? null
        : r.events?.title ?? null,
    }));
    return { data: rows, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

export type EventDirectorsPage = {
  data: EventDirectorRow[];
  total: number;
  error: string | null;
  /** "rpc" = get_event_directors RPC; "unavailable" = migration 000014 not
   *  applied yet — profiles RLS blocks direct reads, so no fallback rows can
   *  be produced. The page shows an on-brand empty state in that case. */
  source: "rpc" | "unavailable";
};

/**
 * Paged event-director directory for the About Us page. All the heavy
 * aggregation (events posted, cumulative reviews, review-weighted average
 * rating) happens in the RPC in a single trip — no per-card fetches.
 *
 * If the RPC isn't deployed yet (migration 20240101000014), profiles' locked
 * RLS makes it impossible to synthesize the same data from PostgREST alone,
 * so we surface `source: "unavailable"` and the caller renders an empty state.
 */
export async function getEventDirectors({
  page = 1,
  pageSize = 12,
}: { page?: number; pageSize?: number } = {}): Promise<EventDirectorsPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const offset = (safePage - 1) * pageSize;

  try {
    const sb = createServerClient();
    const { data, error } = await sb.rpc("get_event_directors", {
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error || !data) {
      return { data: [], total: 0, error: error?.message ?? null, source: "unavailable" };
    }

    const rows = data as (EventDirectorRow & { total_count: number | string | null })[];
    const total = rows.length ? Number(rows[0].total_count ?? 0) : 0;

    return {
      data: rows.map((r) => ({
        id: r.id,
        display_name: r.display_name,
        contact_email: r.contact_email,
        profile_picture: r.profile_picture,
        org_logo: r.org_logo,
        club_affiliation: r.club_affiliation,
        event_count: Number(r.event_count ?? 0),
        total_reviews: Number(r.total_reviews ?? 0),
        avg_rating: Number(r.avg_rating ?? 0),
      })),
      total,
      error: null,
      source: "rpc",
    };
  } catch (e) {
    return {
      data: [],
      total: 0,
      error: e instanceof Error ? e.message : "Request failed",
      source: "unavailable",
    };
  }
}

/* ─── Event detail page ───────────────────────────────────────────────── */

export type EventDetailRow = EventRow & {
  event_director: string | null;
  event_profile_id: string | null;
  registration_deadline: string | null;
  website: string | null;
  this_year_website: string | null;
  previous_year_website: string | null;
  registration_link: string | null;
  qr_code: string | null;
  photos: string[] | null;
  updated_at: string | null;
};

/** Shape matches the existing EVENT_SELECT so anon grants are guaranteed
 *  to line up with what already ships (Find Events / director pages).
 *  Extra scalar columns on `events` are additive and safe; we skip
 *  `event_features` here because nothing on the page renders it yet, and
 *  including a join whose anon GRANT status hasn't been audited turned a
 *  successful row into a silent PostgREST 400. */
const EVENT_DETAIL_SELECT = `
  id, title, description, owner_id, host_club, event_director,
  event_profile_id, registration_deadline, website, this_year_website,
  previous_year_website, registration_link, qr_code, photos,
  location_text, state, region,
  start_date, end_date, status, premium, logo,
  general_rating, coach_rating, attendee_rating, reviews,
  nr_teams_last_year, created_at, updated_at,
  event_ages ( age ),
  event_competition_levels ( level ),
  event_fields ( surface ),
  event_genders ( gender )
`;

/** Fetch a single event by id for the public event page. Returns null when
 *  the event doesn't exist, is draft (RLS-hidden for anon), or on error.
 *  Real Supabase errors get logged server-side so the page's `notFound()`
 *  fallback isn't a silent black-hole during development. */
export async function getEventById(
  id: string,
): Promise<EventDetailRow | null> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("events")
      .select(EVENT_DETAIL_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[getEventById] supabase error", { id, error });
      return null;
    }
    if (!data) return null;
    const [row] = await attachHostLogos(sb, [data as EventDetailRow]);
    const [enriched] = await attachReviewCounts(sb, [row]);
    return enriched as EventDetailRow;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[getEventById] threw", { id, error: e });
    return null;
  }
}

/* ── Event age-group pricing rows ──────────────────────────────────── */

export type EventAgeGroupRow = {
  id: string;
  age: string | null;
  gender: string | null;
  label: string | null;
  price: number | null;
  age_index: number | null;
};

export async function getEventAgeGroups(
  eventId: string,
): Promise<EventAgeGroupRow[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("event_age_groups")
      .select("id, age, gender, label, price, age_index")
      .eq("event_id", eventId)
      .order("age_index", { ascending: true, nullsFirst: false });
    if (error || !data) return [];
    return (data as EventAgeGroupRow[]).map((r) => ({
      ...r,
      price: r.price == null ? null : Number(r.price),
    }));
  } catch {
    return [];
  }
}

/* ── Event sponsors ────────────────────────────────────────────────── */

export type SponsorRow = {
  id: string;
  name: string | null;
  logo: string | null;
  link: string | null;
};

export async function getEventSponsors(eventId: string): Promise<SponsorRow[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("sponsors")
      .select("id, name, logo, link")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as SponsorRow[]).filter((s) => s.name || s.logo);
  } catch {
    return [];
  }
}

/* ── Reviews for the event page ────────────────────────────────────
   Published reviews only. Author display data is denormalized on the
   review row (username/user_role), and the Coach/Attendee split
   follows the codebase convention: user_role ilike '%coach%' = coach.
   Everyone else (including nulls) counts as an attendee. Same split
   the recalc_event_ratings trigger and get_event_review_counts RPC
   use, so the totals line up with events.coach_rating /
   attendee_rating. */

export type EventReviewRow = {
  id: string;
  review_title: string | null;
  review_body: string | null;
  overall_rating: number | null;
  facilities_rating: number | null;
  fields_rating: number | null;
  management_rating: number | null;
  cost_value_rating: number | null;
  competition_rating: number | null;
  diversity_rating: number | null;
  username: string | null;
  user_role: string | null;
  team_age: string | null;
  team_gender: string | null;
  guru_review: boolean | null;
  created_at: string;
  author_id: string | null;
  event_id: string | null;
  event_title: string | null;
  /** "coach" when user_role matches %coach%, "attendee" otherwise. */
  kind: "coach" | "attendee";
};

type RawReview = {
  id: string;
  review_title: string | null;
  review_body: string | null;
  overall_rating: number | null;
  facilities_rating: number | null;
  fields_rating: number | null;
  management_rating: number | null;
  cost_value_rating: number | null;
  competition_rating: number | null;
  diversity_rating: number | null;
  username: string | null;
  user_role: string | null;
  team_age: string | null;
  team_gender: string | null;
  guru_review: boolean | null;
  created_at: string;
  author_id: string | null;
  event_id: string | null;
  events: { title: string | null } | { title: string | null }[] | null;
};

function shapeReview(r: RawReview): EventReviewRow {
  const role = r.user_role ?? "";
  const isCoach = /coach/i.test(role);
  return {
    id: r.id,
    review_title: r.review_title,
    review_body: r.review_body,
    overall_rating:
      r.overall_rating == null ? null : Number(r.overall_rating),
    facilities_rating:
      r.facilities_rating == null ? null : Number(r.facilities_rating),
    fields_rating: r.fields_rating == null ? null : Number(r.fields_rating),
    management_rating:
      r.management_rating == null ? null : Number(r.management_rating),
    cost_value_rating:
      r.cost_value_rating == null ? null : Number(r.cost_value_rating),
    competition_rating:
      r.competition_rating == null ? null : Number(r.competition_rating),
    diversity_rating:
      r.diversity_rating == null ? null : Number(r.diversity_rating),
    username: r.username,
    user_role: r.user_role,
    team_age: r.team_age,
    team_gender: r.team_gender,
    guru_review: r.guru_review,
    created_at: r.created_at,
    author_id: r.author_id,
    event_id: r.event_id,
    event_title: Array.isArray(r.events)
      ? r.events[0]?.title ?? null
      : r.events?.title ?? null,
    kind: isCoach ? "coach" : "attendee",
  };
}

const REVIEW_SELECT = `
  id, review_title, review_body,
  overall_rating, facilities_rating, fields_rating, management_rating,
  cost_value_rating, competition_rating, diversity_rating,
  username, user_role, team_age, team_gender, guru_review,
  created_at, author_id, event_id,
  events:event_id ( title )
`;

/** Published reviews for a single event, most recent first. */
export async function getEventReviews(
  eventId: string,
): Promise<EventReviewRow[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("reviews")
      .select(REVIEW_SELECT)
      .eq("event_id", eventId)
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as RawReview[]).map(shapeReview);
  } catch {
    return [];
  }
}

/** Published reviews from OTHER events sharing the same event_profile_id
 *  (recurring parent tournament). Used as the fallback on a future event
 *  that has no reviews of its own yet. Empty when parentId is null or
 *  the parent has no siblings with published reviews. */
export async function getParentTournamentReviews(
  parentId: string | null,
  excludeEventId: string,
  limit = 20,
): Promise<EventReviewRow[]> {
  if (!parentId) return [];
  try {
    const sb = createServerClient();
    const { data: siblings, error: sibErr } = await sb
      .from("events")
      .select("id")
      .eq("event_profile_id", parentId)
      .neq("id", excludeEventId);
    if (sibErr || !siblings || siblings.length === 0) return [];
    const ids = siblings.map((s) => s.id as string);

    const { data, error } = await sb
      .from("reviews")
      .select(REVIEW_SELECT)
      .in("event_id", ids)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as RawReview[]).map(shapeReview);
  } catch {
    return [];
  }
}

/* ── Other events by the same organization ──────────────────────────
   Reuses the same EVENT_SELECT + host-logo attachment as the search
   page so the existing EventCard renders identically. Non-draft, most
   recent first, excluding the current event. */

export async function getOtherEventsByOwner(
  ownerId: string | null,
  excludeEventId: string,
  limit = 4,
): Promise<EventRow[]> {
  if (!ownerId) return [];
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("events")
      .select(EVENT_SELECT)
      .eq("owner_id", ownerId)
      .neq("id", excludeEventId)
      .neq("status", "draft")
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    const enriched = await attachReviewCounts(
      sb,
      await attachHostLogos(sb, data as EventRow[]),
    );
    return enriched;
  } catch {
    return [];
  }
}

/* ── Parent tournament summary (recurring event_profile) ────────────
   Used to show "Reviews from past editions of this tournament" context
   when we fall back to sibling reviews on a future event. */

export type EventProfileSummary = {
  id: string;
  title: string;
  reviews: number;
  general_rating: number;
};

export async function getEventProfile(
  id: string | null,
): Promise<EventProfileSummary | null> {
  if (!id) return null;
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("event_profiles")
      .select("id, title, reviews, general_rating")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id as string,
      title: (data.title as string) ?? "",
      reviews: Number(data.reviews ?? 0),
      general_rating: Number(data.general_rating ?? 0),
    };
  } catch {
    return null;
  }
}
