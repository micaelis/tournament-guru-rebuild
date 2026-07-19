/**
 * Error-surfacing class probe (S8.9) — sibling query sites to the H-0
 * fix. A DB failure on a read path must never render as a plausible
 * empty state ("no directors yet", "no reviews", empty moderation
 * queue). Three contracts are pinned, each on representative
 * high-traffic functions:
 *
 *  1. THROW — content reads reject on a query error (director profile,
 *     director events/reviews, ED dashboard review scoping, the
 *     banned-words moderation list).
 *  2. DESIGNED DEGRADE — `getEventDirectors` returns the (previously
 *     unreachable) `source: "unavailable"` marker so the About grid
 *     renders its "temporarily unavailable" state, and logs the error.
 *  3. LOGGED DEGRADE — landing chrome (`fetchFeaturedEventRows`)
 *     renders empty but MUST log; silent degradation is the bug class.
 *
 * Failures are genuine PostgREST errors (a proxy rewrites one table
 * name per test to a nonexistent one), hitting only the targeted query.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const ctl = vi.hoisted(() => ({ breakTable: null as string | null }));

vi.mock("@/lib/supabase/server", async () => {
  const { anon } = await import("../harness");
  const wrap = (real: SupabaseClient): SupabaseClient =>
    new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "from") {
          return (table: string) =>
            target.from(table === ctl.breakTable ? `${table}_es_missing` : table);
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as SupabaseClient;
  return {
    createAnonServerClient: () => wrap(anon()),
    createServerAuthClient: async () => wrap(anon()),
  };
});

import {
  getDirectorProfile,
  getEventDirectors,
  getDirectorEventRows,
} from "@/lib/directors/queries";
import { listReviewsForEvents } from "@/lib/reviews/queries";
import { fetchFeaturedEventRows } from "@/app/(site)/queries";
import { fetchBannedWords } from "@/lib/reviews/banned-words";
import { listDashboardReviews } from "@/app/dashboard/reviews/queries";

let edId = "";
let eventId = "";
let tournamentId = "";

beforeAll(async () => {
  // Signup as an ED via metadata (the real signup path) so the profile
  // lands in public_directors; role/type can't be flipped after
  // onboarding (role lock trigger + role_matches_type CHECK).
  const user = await createUser({
    metadata: { user_type: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  edId = user.id;
  const seeded = await seedTournamentAndEvent(user.client);
  eventId = seeded.eventId;
  tournamentId = seeded.tournamentId;
});

afterAll(async () => {
  const svc = service();
  await svc.from("events").delete().eq("id", eventId);
  await svc.from("tournaments").delete().eq("id", tournamentId);
  await purge([edId]);
});

beforeEach(() => {
  ctl.breakTable = null;
});

describe("error-surfacing · content reads throw instead of rendering empty", () => {
  it("sanity: the seeded director resolves through this harness", async () => {
    const profile = await getDirectorProfile(edId);
    expect(profile?.id).toBe(edId);
    expect(profile?.total_events).toBeGreaterThanOrEqual(1);
  });

  it("getDirectorProfile rejects when the directors view fails (was: 404 for a live director)", async () => {
    ctl.breakTable = "public_directors";
    await expect(getDirectorProfile(edId)).rejects.toThrow(/getDirectorProfile director/);
  });

  it("getDirectorProfile rejects when the events read fails", async () => {
    ctl.breakTable = "events";
    await expect(getDirectorProfile(edId)).rejects.toThrow(/getDirectorProfile events/);
  });

  it("getDirectorEventRows rejects when the events read fails", async () => {
    ctl.breakTable = "events";
    await expect(getDirectorEventRows(edId)).rejects.toThrow(/getDirectorEventRows/);
  });

  it("listReviewsForEvents (ED page reviews tab) rejects when the reviews read fails", async () => {
    ctl.breakTable = "reviews";
    await expect(listReviewsForEvents([eventId])).rejects.toThrow(
      /listReviewsForEvents reviews/,
    );
  });

  it("listDashboardReviews rejects when the owned-events scoping read fails (was: ED sees no reviews)", async () => {
    ctl.breakTable = "events";
    await expect(
      listDashboardReviews({ userId: edId, scope: "own" }),
    ).rejects.toThrow(/listDashboardReviews owned events/);
  });

  it("fetchBannedWords rejects instead of silently disabling moderation", async () => {
    ctl.breakTable = "banned_words";
    await expect(fetchBannedWords()).rejects.toThrow(/fetchBannedWords/);
  });
});

describe("error-surfacing · designed degraded states are reachable and loud", () => {
  it("getEventDirectors returns source 'unavailable' (not 'rpc') and logs when the query fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      ctl.breakTable = "public_directors";
      const page = await getEventDirectors({ page: 1, pageSize: 6 });
      expect(page.source).toBe("unavailable");
      expect(page.data).toEqual([]);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("getEventDirectors still reports source 'rpc' on a healthy query", async () => {
    const page = await getEventDirectors({ page: 1, pageSize: 6 });
    expect(page.source).toBe("rpc");
  });

  it("fetchFeaturedEventRows degrades to [] but LOGS the failure (never silent)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      ctl.breakTable = "events";
      const rows = await fetchFeaturedEventRows();
      expect(rows).toEqual([]);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("fetchFeaturedEventRows"),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
