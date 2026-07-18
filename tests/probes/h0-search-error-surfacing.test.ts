/**
 * H-0 probe — a facet sub-query failure inside `searchEvents` must
 * PROPAGATE, never collapse into a successful "0 events" result.
 *
 * The original bug: the five facet sub-queries used bare
 * `const { data }`, so a query error became `data = null` → an empty
 * id set → `.eq("id", ZERO_UUID)` → the final query SUCCEEDED with 0
 * rows and the error guard on the main query never fired. An RLS or
 * schema change on a facet table would silently blank every filtered
 * search.
 *
 * Mechanism here: `createAnonServerClient` is mocked to wrap a real
 * local-stack client in a proxy that can rewrite one table name to a
 * nonexistent one. The failure is a genuine PostgREST error through
 * the real stack (the schema-drift class), not a fabricated object —
 * and it hits ONLY the targeted sub-query, so a swallowed error still
 * produces a green main query, which is exactly the case that must
 * now throw.
 *
 * The flip side is also pinned: filter values arrive from raw URL
 * strings, so INVALID USER INPUT must not be able to manufacture a
 * query error (or, post-fix, a 500). Unknown enum values are dropped,
 * malformed dates ignored, and hostile `q` strings tolerated.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";
import { unwrap, unwrapRows } from "@/lib/supabase/unwrap";

const ctl = vi.hoisted(() => ({
  breakTable: null as string | null,
  // 1-based index of the .from("events") call to break; 0 = off. Lets
  // the distance prefilter (the FIRST events query) fail while the
  // main events query stays healthy.
  breakNthEventsCall: 0,
  eventsCalls: 0,
}));

vi.mock("@/lib/supabase/server", async () => {
  const { anon } = await import("../harness");
  const broken = (table: string) => `${table}_h0_missing`;
  return {
    createAnonServerClient: (): SupabaseClient => {
      const real = anon();
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === "from") {
            return (table: string) => {
              let t = table;
              if (table === "events" && ctl.breakNthEventsCall > 0) {
                ctl.eventsCalls += 1;
                if (ctl.eventsCalls === ctl.breakNthEventsCall) t = broken(table);
              } else if (table === ctl.breakTable) {
                t = broken(table);
              }
              return target.from(t);
            };
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as SupabaseClient;
    },
  };
});

import { searchEvents, getEventFacets, type SearchFilters } from "@/lib/events/search";

beforeEach(() => {
  ctl.breakTable = null;
  ctl.breakNthEventsCall = 0;
  ctl.eventsCalls = 0;
});

describe("h0 · facet sub-query errors propagate out of searchEvents", () => {
  it("sanity: an unbroken filtered search resolves through this harness", async () => {
    const res = await searchEvents({ surfaces: ["turf"] });
    expect(Array.isArray(res.data)).toBe(true);
    expect(typeof res.total).toBe("number");
  });

  const facetCases: { label: string; table: string; filters: SearchFilters }[] = [
    { label: "ages", table: "event_age_groups", filters: { ages: ["u12"] } },
    { label: "genders", table: "event_age_groups", filters: { genders: ["boys"] } },
    { label: "surfaces", table: "event_surfaces", filters: { surfaces: ["turf"] } },
    { label: "levels", table: "event_competition_levels", filters: { levels: ["highest"] } },
  ];

  it.each(facetCases)(
    "a $label facet failure rejects instead of returning empty results",
    async ({ table, filters }) => {
      ctl.breakTable = table;
      await expect(searchEvents(filters)).rejects.toThrow(/facet/);
    },
  );

  it("a distance prefilter failure rejects instead of returning empty results", async () => {
    ctl.breakNthEventsCall = 1;
    await expect(
      searchEvents({ distanceMiles: 150, centerLat: 39.1, centerLng: -94.6 }),
    ).rejects.toThrow(/distance facet/);
  });

  it("a us_states failure rejects getEventFacets instead of blanking the state list", async () => {
    ctl.breakTable = "us_states";
    await expect(getEventFacets()).rejects.toThrow(/states/);
  });
});

describe("h0 · invalid filter input is dropped, not turned into a query error", () => {
  let userId = "";
  let eventId = "";
  let tournamentId = "";
  let title = "";

  beforeAll(async () => {
    const user = await createUser({ completeOnboarding: true, role: "event_director" });
    userId = user.id;
    const seeded = await seedTournamentAndEvent(user.client);
    eventId = seeded.eventId;
    tournamentId = seeded.tournamentId;
    const svc = service();
    const { data: ev, error } = await svc
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single();
    if (error) throw new Error(error.message);
    title = (ev as { title: string }).title;
    const marker = `H0 Facet ${randomUUID().slice(0, 6)}`;
    title = `${title} ${marker}`;
    const upd = await svc.from("events").update({ title }).eq("id", eventId);
    if (upd.error) throw new Error(upd.error.message);
    const ins = await svc
      .from("event_surfaces")
      .insert({ event_id: eventId, surface: "turf" });
    if (ins.error) throw new Error(ins.error.message);
  });

  afterAll(async () => {
    const svc = service();
    await svc.from("events").delete().eq("id", eventId);
    await svc.from("tournaments").delete().eq("id", tournamentId);
    await purge([userId]);
  });

  it("unknown enum values are ignored while valid ones still apply", async () => {
    const res = await searchEvents({ q: title, surfaces: ["turf", "lava"] });
    expect(res.data.map((e) => e.id)).toContain(eventId);
  });

  it("valid facet values still constrain the search (the filter is not dropped wholesale)", async () => {
    const res = await searchEvents({ q: title, surfaces: ["grass"] });
    expect(res.data.map((e) => e.id)).not.toContain(eventId);
  });

  it("a filter containing only unknown values behaves as if unset", async () => {
    const res = await searchEvents({ q: title, genders: ["zzz"] });
    expect(res.data.map((e) => e.id)).toContain(eventId);
  });

  it("malformed dates are ignored rather than sent to the DB", async () => {
    const res = await searchEvents({
      q: title,
      dateStart: "not-a-date",
      dateEnd: "2026-99-99",
    });
    expect(res.data.map((e) => e.id)).toContain(eventId);
  });

  it("hostile q strings (or-grammar metacharacters) resolve instead of erroring", async () => {
    const res = await searchEvents({ q: 'a,b(c)"d\\e' });
    expect(Array.isArray(res.data)).toBe(true);
  });

  it("q still matches through the quoted pattern", async () => {
    const res = await searchEvents({ q: title });
    expect(res.data.map((e) => e.id)).toContain(eventId);
  });
});

describe("h0 · unwrap helper", () => {
  it("throws with context, code, and message on error", () => {
    expect(() =>
      unwrap(
        {
          data: null,
          error: { code: "42703", message: "column does not exist" } as never,
        },
        "probe context",
      ),
    ).toThrow(/probe context: \[42703\] column does not exist/);
  });

  it("passes results through and coalesces null rows", () => {
    expect(unwrapRows({ data: [{ a: 1 }], error: null }, "ctx")).toEqual([{ a: 1 }]);
    expect(unwrapRows({ data: null, error: null }, "ctx")).toEqual([]);
    const { count } = unwrap({ data: [], count: 7, error: null }, "ctx");
    expect(count).toBe(7);
  });
});
