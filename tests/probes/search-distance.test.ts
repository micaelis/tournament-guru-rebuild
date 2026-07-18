/**
 * Search distance-filter probe (RG10.1) — the tier math and how it
 * composes with the rest of the search.
 *
 * `searchEvents` runs distance as a cheap SQL bounding-box prefilter
 * plus an exact Haversine pass in JS, then intersects the surviving id
 * set with the other facet id sets. Three things have to hold and none
 * of them were pinned:
 *
 *  1. TIER MATH — each threshold includes/excludes the right events.
 *     Fixtures sit due north of the origin at distances chosen to
 *     straddle every boundary, including 149 vs 151 miles, so an
 *     off-by-a-few-percent radius (a wrong Earth radius, a degrees/
 *     radians slip, miles↔km) moves at least one event across a line.
 *     Deliberately NOT pinned: an event sitting EXACTLY on a threshold.
 *     There the inclusive/exclusive margin is ~1e-13 miles, below the
 *     float noise of a lat/lng round-trip through PostgREST, so such a
 *     fixture flips at random. `<=` vs `<` at an irrational boundary is
 *     not a distinction any user can observe; the 149/151 straddle is.
 *  2. INTERSECTION — distance ANDs with the facet filters; it does not
 *     replace or widen them.
 *  3. NO COORDINATES — an event without lat/lng is excluded while the
 *     distance filter is active, but still listed when it is off. The
 *     `gte/lte` prefilter drops NULLs silently, so this needs saying
 *     out loud.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

vi.mock("@/lib/supabase/server", async () => {
  const { anon } = await import("../harness");
  return { createAnonServerClient: () => anon() };
});

import { searchEvents } from "@/lib/events/search";
import { milesBetween } from "@/lib/geo";

// Kansas City, MO — the origin every fixture is measured from.
const ORIGIN = { lat: 39.0997, lng: -94.5786 };

/**
 * Degrees of latitude per mile along a meridian, from the same mean
 * Earth radius `milesBetween` uses. Placing fixtures due north makes
 * the intended distance exact rather than approximate, so the
 * boundary cases below are trustworthy.
 */
const DEG_PER_MILE = 360 / (2 * Math.PI * 3958.7613);

/** A fixture due north of ORIGIN at (about) `miles`. */
function northOf(miles: number) {
  return { lat: ORIGIN.lat + miles * DEG_PER_MILE, lng: ORIGIN.lng };
}

const tag = `dist-${randomUUID().slice(0, 8)}`;

/** Every fixture: label → intended distance in miles (null = no coords). */
const FIXTURES = [
  { key: "at-70", miles: 70, surface: "grass" },
  { key: "at-149", miles: 149, surface: "turf" },
  { key: "at-151", miles: 151, surface: "grass" },
  { key: "at-280", miles: 280, surface: "grass" },
  { key: "at-320", miles: 320, surface: "turf" },
  { key: "at-430", miles: 430, surface: "grass" },
  { key: "at-500", miles: 500, surface: "grass" },
  { key: "no-coords", miles: null, surface: "grass" },
] as const;

let edId = "";
let tournamentId = "";
const idByKey = new Map<string, string>();
const keyById = new Map<string, string>();

/** Titles of the results, as fixture keys, for readable assertions. */
function keysOf(rows: { id: string }[]): string[] {
  return rows
    .map((r) => keyById.get(r.id))
    .filter((k): k is string => Boolean(k))
    .sort();
}

async function search(extra: Record<string, unknown> = {}) {
  const page = await searchEvents(
    { q: tag, ...extra } as Parameters<typeof searchEvents>[0],
    { page: 1, pageSize: 50, sort: "date" },
  );
  return keysOf(page.data);
}

/** Distance filter args for a tier, measured from ORIGIN. */
function within(miles: number) {
  return {
    distanceMiles: miles,
    centerLat: ORIGIN.lat,
    centerLng: ORIGIN.lng,
  };
}

beforeAll(async () => {
  const ed = await createUser({
    metadata: { user_type: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  edId = ed.id;
  const seeded = await seedTournamentAndEvent(ed.client);
  tournamentId = seeded.tournamentId;
  // The harness event has no coordinates and would pollute the counts.
  const svc = service();
  await svc.from("events").delete().eq("id", seeded.eventId);

  for (const f of FIXTURES) {
    const coords = f.miles === null ? null : northOf(f.miles);
    const { data, error } = await svc
      .from("events")
      .insert({
        tournament_id: tournamentId,
        owner_id: edId,
        created_by: edId,
        claimed: true,
        // `q` matches on title, so the tag scopes every query in this
        // file to this run's fixtures only.
        title: `${tag} ${f.key}`,
        lifecycle: "active",
        start_date: "2030-06-01",
        end_date: "2030-06-03",
        location_lat: coords?.lat ?? null,
        location_lng: coords?.lng ?? null,
      })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(`fixture ${f.key}: ${error.message}`);
    idByKey.set(f.key, data.id);
    keyById.set(data.id, f.key);
    await svc
      .from("event_surfaces")
      .insert({ event_id: data.id, surface: f.surface });
  }
});

afterAll(async () => {
  const svc = service();
  await svc.from("events").delete().eq("tournament_id", tournamentId);
  await svc.from("tournaments").delete().eq("id", tournamentId);
  await purge([edId]);
});

describe("search distance · fixtures are where the test thinks they are", () => {
  it("each fixture's true Haversine distance matches its intended miles", () => {
    for (const f of FIXTURES) {
      if (f.miles === null) continue;
      const p = northOf(f.miles);
      const actual = milesBetween(ORIGIN.lat, ORIGIN.lng, p.lat, p.lng);
      expect(actual).toBeCloseTo(f.miles, 1);
    }
  });
});

describe("search distance · tier math", () => {
  it("no distance filter lists every fixture, coordinates or not", async () => {
    expect(await search()).toEqual(
      [...FIXTURES.map((f) => f.key)].sort(),
    );
  });

  it("within 150 mi keeps 70 and 149, drops 151 and beyond", async () => {
    expect(await search(within(150))).toEqual(["at-149", "at-70"]);
  });

  it("within 300 mi adds 151 and 280, still drops 320", async () => {
    expect(await search(within(300))).toEqual([
      "at-149",
      "at-151",
      "at-280",
      "at-70",
    ]);
  });

  it("within 450 mi adds 320 and 430, still drops 500", async () => {
    expect(await search(within(450))).toEqual([
      "at-149",
      "at-151",
      "at-280",
      "at-320",
      "at-430",
      "at-70",
    ]);
  });

  it("each tier is a strict superset of the tier below it", async () => {
    const [t150, t300, t450] = await Promise.all([
      search(within(150)),
      search(within(300)),
      search(within(450)),
    ]);
    expect(t300).toEqual(expect.arrayContaining(t150));
    expect(t450).toEqual(expect.arrayContaining(t300));
    expect(t300.length).toBeGreaterThan(t150.length);
    expect(t450.length).toBeGreaterThan(t300.length);
  });
});

describe("search distance · events without coordinates", () => {
  it("is listed when the filter is off but excluded from every tier", async () => {
    expect(await search()).toContain("no-coords");
    for (const miles of [150, 300, 450]) {
      expect(await search(within(miles))).not.toContain("no-coords");
    }
  });

  it("a wide radius still cannot pull it in", async () => {
    expect(await search(within(5000))).not.toContain("no-coords");
  });
});

describe("search distance · intersects with the other filters", () => {
  it("distance AND surface returns only events matching both", async () => {
    // Within 300 mi: 70(grass) 149(turf) 151(grass) 280(grass).
    // Turf overall: 149, 320.  The intersection is 149 alone.
    expect(await search({ ...within(300), surfaces: ["turf"] })).toEqual([
      "at-149",
    ]);
  });

  it("narrowing the radius narrows an already-faceted result", async () => {
    expect(await search({ ...within(450), surfaces: ["turf"] })).toEqual([
      "at-149",
      "at-320",
    ]);
    expect(await search({ ...within(150), surfaces: ["turf"] })).toEqual([
      "at-149",
    ]);
  });

  it("an empty intersection returns nothing, not the distance set", async () => {
    // 70 is grass and inside 150; asking for turf inside 100 leaves
    // nothing. A broken intersection would fall back to one side.
    expect(await search({ ...within(100), surfaces: ["turf"] })).toEqual([]);
  });

  it("distance does not widen a facet filter that already excludes an event", async () => {
    const grassIn150 = await search({ ...within(150), surfaces: ["grass"] });
    expect(grassIn150).toEqual(["at-70"]);
    expect(grassIn150).not.toContain("at-149");
  });
});

describe("search distance · the filter only applies when fully specified", () => {
  it("miles without a center is ignored (the no-origin case)", async () => {
    // What the UI produces when a tier is picked but no location is
    // set — it must not silently filter against a null origin.
    expect(await search({ distanceMiles: 150 })).toEqual(
      [...FIXTURES.map((f) => f.key)].sort(),
    );
  });

  it("a center without miles is ignored", async () => {
    expect(
      await search({ centerLat: ORIGIN.lat, centerLng: ORIGIN.lng }),
    ).toEqual([...FIXTURES.map((f) => f.key)].sort());
  });
});
