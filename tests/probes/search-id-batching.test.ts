/**
 * Search id-batching probe (S11.7) — `searchEvents` filters by the
 * merged facet id set, which is unbounded: at ~200 UUIDs a single
 * `.in("id", ids)` dies with "URI too long" (the S11.6 class; search
 * was its flagged known limit). The fix pages over the merged id set
 * in app code — sort keys fetched per chunk, ordered by an app-side
 * mirror of the SQL ORDER BY, then one pageSize-bounded row fetch —
 * so this probe drives a 260-event facet match end to end and pins:
 *
 *  1. SURVIVAL — the filtered search resolves and counts all 260.
 *  2. ORDER — premium-first, then the sort key, across chunk
 *     boundaries (the earliest-dated event is inserted LAST, so it
 *     lives in the last chunk yet must lead the non-premium results).
 *  3. PAGINATION — pages tile the full sorted order exactly: no
 *     duplicates, no gaps, stable totals, empty past the end.
 *  4. INTERSECTION — a second facet still narrows (never widens) the
 *     big set, and an empty intersection stays empty.
 *  5. TIE-BREAKS — events sharing a sort key fall through to
 *     created_at DESC then id ASC, and the app-side comparator agrees
 *     with the SQL path's ORDER BY on the same fixture, page by page.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createUser, purge, service } from "../harness";

vi.mock("@/lib/supabase/server", async () => {
  const { anon } = await import("../harness");
  return { createAnonServerClient: () => anon() };
});

import { searchEvents } from "@/lib/events/search";
import { IN_CHUNK_SIZE } from "@/lib/supabase/in-chunks";

const COUNT = 260; // > IN_CHUNK_SIZE and > the observed ~220-id failure point
const PREMIUM_IDX = 5; // early insert (first chunk), late date — premium tier must trump the sort key
const TEAMS_BY_IDX = new Map<number, number>([
  [100, 500],
  [200, 400],
]);
// Distinct ratings on both sides of the 150-id chunk boundary; the top
// rating is inserted LAST so rating-desc order must reach across
// chunks. Everything else keeps a NULL rating (numeric(3,2), max 9.99).
const RATING_BY_IDX = new Map<number, number>([
  [259, 4.9],
  [155, 4.7],
  [30, 4.5],
  [200, 4.1],
  [80, 3.2],
  [1, 2.6],
]);
const U12_IDXS = [3, 130, 258]; // one per chunk region

const tag = `idbatch-${randomUUID().slice(0, 8)}`;

/** 2030-01-01 + offset days, as the ISO date the DB stores. */
function day(offset: number): string {
  const d = new Date(Date.UTC(2030, 0, 1));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Insertion index i gets a date DESCENDING in i — the LAST-inserted
 * event carries the earliest date, so date-sort order is exactly the
 * reverse of insertion (and of the facet id set's natural order). */
const startDate = (i: number) => day(COUNT - 1 - i);

let edId = "";
let tournamentId = "";
let eventIds: string[] = []; // by insertion index

// Tie fixture: separate tag (NOT containing `tag`, so neither q scopes
// into the other), all sharing ONE start_date. Three insert groups get
// explicit, strictly increasing created_at stamps; rows WITHIN a group
// share theirs — so date sort must fall through created_at DESC between
// groups and id ASC inside one.
const tieTag = `tiebatch-${randomUUID().slice(0, 8)}`;
const TIE_GROUPS = 3;
const TIE_PER_GROUP = 4;
const TIE_COUNT = TIE_GROUPS * TIE_PER_GROUP;
const tieIdsByGroup: string[][] = []; // [group][insertion order]

async function search(
  filters: Record<string, unknown>,
  opts: Record<string, unknown> = {},
) {
  return searchEvents(
    { q: tag, ...filters } as Parameters<typeof searchEvents>[0],
    { page: 1, pageSize: 12, sort: "date", ...opts } as Parameters<
      typeof searchEvents
    >[1],
  );
}

beforeAll(async () => {
  const ed = await createUser({
    metadata: { user_type: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  edId = ed.id;
  const svc = service();

  const { data: t, error: tErr } = await svc
    .from("tournaments")
    .insert({ title: `${tag} cup`, owner_id: edId, created_by: edId, claimed: true })
    .select("id")
    .single<{ id: string }>();
  if (tErr) throw new Error(`seed tournament: ${tErr.message}`);
  tournamentId = t.id;

  const { data: evs, error: evErr } = await svc
    .from("events")
    .insert(
      Array.from({ length: COUNT }, (_, i) => ({
        tournament_id: tournamentId,
        owner_id: edId,
        created_by: edId,
        claimed: true,
        title: `${tag} ev ${String(i).padStart(3, "0")}`,
        lifecycle: "active",
        start_date: startDate(i),
        end_date: startDate(i),
        is_premium: i === PREMIUM_IDX,
        teams_attended_prev_year: TEAMS_BY_IDX.get(i) ?? null,
        general_rating: RATING_BY_IDX.get(i) ?? null,
      })),
    )
    .select("id");
  if (evErr) throw new Error(`seed events: ${evErr.message}`);
  eventIds = (evs ?? []).map((r) => r.id as string);
  if (eventIds.length !== COUNT) throw new Error("seed events: short insert");

  const { error: sErr } = await svc
    .from("event_surfaces")
    .insert(eventIds.map((event_id) => ({ event_id, surface: "turf" })));
  if (sErr) throw new Error(`seed surfaces: ${sErr.message}`);

  const { error: aErr } = await svc.from("event_age_groups").insert(
    U12_IDXS.map((i) => ({
      event_id: eventIds[i],
      age: "U12",
      team_gender: "both",
      price: 500,
      field_size: "11v11",
    })),
  );
  if (aErr) throw new Error(`seed age groups: ${aErr.message}`);

  for (let g = 0; g < TIE_GROUPS; g++) {
    const { data: tied, error: tieErr } = await svc
      .from("events")
      .insert(
        Array.from({ length: TIE_PER_GROUP }, (_, k) => ({
          tournament_id: tournamentId,
          owner_id: edId,
          created_by: edId,
          claimed: true,
          title: `${tieTag} ev ${g}-${k}`,
          lifecycle: "active",
          start_date: "2031-05-05",
          end_date: "2031-05-05",
          created_at: `2026-01-0${g + 1}T00:00:00Z`,
        })),
      )
      .select("id");
    if (tieErr) throw new Error(`seed tie group ${g}: ${tieErr.message}`);
    tieIdsByGroup.push((tied ?? []).map((r) => r.id as string));
  }
  const { error: tieSErr } = await svc
    .from("event_surfaces")
    .insert(
      tieIdsByGroup.flat().map((event_id) => ({ event_id, surface: "turf" })),
    );
  if (tieSErr) throw new Error(`seed tie surfaces: ${tieSErr.message}`);
});

afterAll(async () => {
  const svc = service();
  await svc.from("events").delete().eq("tournament_id", tournamentId);
  await svc.from("tournaments").delete().eq("id", tournamentId);
  await purge([edId]);
});

/** The one true date-sort order: premium first, then date ascending
 * (all fixture dates are distinct, so the order is fully determined). */
function expectedDateOrder(): string[] {
  const rest = eventIds
    .map((id, i) => ({ id, i }))
    .filter(({ i }) => i !== PREMIUM_IDX)
    .sort((a, b) => startDate(a.i).localeCompare(startDate(b.i)));
  return [eventIds[PREMIUM_IDX], ...rest.map((r) => r.id)];
}

/** The one true rating-sort order: premium first (rating NULL — the
 * tier trumps the key), the rated few descending, then the NULL-rated
 * crowd. The crowd ties on rating AND on created_at (one bulk insert
 * statement shares a single now()), so id ASC decides — lowercase
 * UUIDs sort the same lexicographically as Postgres orders them. */
function expectedRatingOrder(): string[] {
  const rated = [...RATING_BY_IDX.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => eventIds[i]);
  const unrated = eventIds
    .filter((_, i) => i !== PREMIUM_IDX && !RATING_BY_IDX.has(i))
    .sort();
  return [eventIds[PREMIUM_IDX], ...rated, ...unrated];
}

/** The one true tie-fixture order: every start_date is equal, so
 * created_at DESC puts the newest group first, and id ASC orders the
 * rows inside each group (their created_at is shared). */
function expectedTieOrder(): string[] {
  return [...tieIdsByGroup]
    .reverse()
    .flatMap((group) => [...group].sort());
}

describe("search id-batching · a facet match beyond the URI limit", () => {
  it("sanity: the fixture exceeds one chunk and the old failure point", () => {
    expect(COUNT).toBeGreaterThan(IN_CHUNK_SIZE);
    expect(COUNT).toBeGreaterThan(220);
  });

  it("resolves with the full count instead of URI-too-long", async () => {
    const res = await search({ surfaces: ["turf"] });
    expect(res.total).toBe(COUNT);
    expect(res.data).toHaveLength(12);
  });

  it("orders premium first, then the sort key, across chunk boundaries", async () => {
    const res = await search({ surfaces: ["turf"] });
    // The premium event was inserted early with a LATE date; only the
    // premium tier explains it leading a date-ascending sort.
    expect(res.data[0].id).toBe(eventIds[PREMIUM_IDX]);
    // The earliest-dated event was inserted LAST — it comes from the
    // final chunk yet must head the non-premium results.
    expect(res.data[1].id).toBe(eventIds[COUNT - 1]);
  });

  it("teams sort ranks premium, then teams desc, nulls last", async () => {
    const res = await search({ surfaces: ["turf"] }, { sort: "teams", pageSize: 5 });
    expect(res.data.map((e) => e.id).slice(0, 3)).toEqual([
      eventIds[PREMIUM_IDX], // premium trumps its null teams count
      eventIds[100], // 500 teams
      eventIds[200], // 400 teams
    ]);
    expect(res.data[3].nr_teams_last_year).toBeNull();
  });

  it("pages tile the sorted order exactly — no duplicates, no gaps", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        search({ surfaces: ["turf"] }, { page, pageSize: 100 }),
      ),
    );
    expect(pages.map((p) => p.data.length)).toEqual([100, 100, 60]);
    expect(pages.map((p) => p.total)).toEqual([COUNT, COUNT, COUNT]);
    const walked = pages.flatMap((p) => p.data.map((e) => e.id));
    expect(walked).toEqual(expectedDateOrder());
  });

  it("a page past the end is empty but keeps the true total", async () => {
    const res = await search({ surfaces: ["turf"] }, { page: 4, pageSize: 100 });
    expect(res.data).toEqual([]);
    expect(res.total).toBe(COUNT);
  });

  it("rating sort tiles pages DESC with NULLS LAST across chunk boundaries", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        search({ surfaces: ["turf"] }, { page, pageSize: 100, sort: "rating" }),
      ),
    );
    expect(pages.map((p) => p.data.length)).toEqual([100, 100, 60]);
    expect(pages.map((p) => p.total)).toEqual([COUNT, COUNT, COUNT]);
    // Premium leads on tier alone (its rating is NULL), the best-rated
    // event comes from the LAST chunk, and every NULL rating trails the
    // rated few — the exact-order comparison pins all three at once.
    expect(pages.flatMap((p) => p.data.map((e) => e.id))).toEqual(
      expectedRatingOrder(),
    );
  });
});

describe("search id-batching · sort-key ties fall through to created_at, then id", () => {
  it("the id-filtered path tiles tied events without duplicates or drops", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        search({ q: tieTag, surfaces: ["turf"] }, { page, pageSize: 5 }),
      ),
    );
    expect(pages.map((p) => p.data.length)).toEqual([5, 5, 2]);
    expect(pages.map((p) => p.total)).toEqual([TIE_COUNT, TIE_COUNT, TIE_COUNT]);
    expect(pages.flatMap((p) => p.data.map((e) => e.id))).toEqual(
      expectedTieOrder(),
    );
  });

  it("the app-side comparator agrees with the SQL path's total order", async () => {
    // No facet filter → matchingIds stays null → the count+range SQL
    // branch runs its ORDER BY over the very same fixture. Page parity
    // here is what licenses the two paths to coexist.
    const pages = await Promise.all(
      [1, 2, 3].map((page) => search({ q: tieTag }, { page, pageSize: 5 })),
    );
    expect(pages.map((p) => p.total)).toEqual([TIE_COUNT, TIE_COUNT, TIE_COUNT]);
    expect(pages.flatMap((p) => p.data.map((e) => e.id))).toEqual(
      expectedTieOrder(),
    );
  });
});

describe("search id-batching · intersection semantics survive the batching", () => {
  it("a second facet narrows the 260-id set to its true intersection", async () => {
    const res = await search({ surfaces: ["turf"], ages: ["u12"] });
    expect(res.total).toBe(U12_IDXS.length);
    expect(res.data.map((e) => e.id).sort()).toEqual(
      U12_IDXS.map((i) => eventIds[i]).sort(),
    );
  });

  it("an empty intersection stays empty, not the wide set", async () => {
    const res = await search({ surfaces: ["turf"], levels: ["highest"] });
    expect(res.total).toBe(0);
    expect(res.data).toEqual([]);
  });

  it("a facet none of the fixtures carry excludes all of them", async () => {
    const res = await search({ surfaces: ["grass"] });
    expect(res.total).toBe(0);
    expect(res.data).toEqual([]);
  });
});
