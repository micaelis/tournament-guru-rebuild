/**
 * Write-error class probe — the mutation-side twin of
 * `error-surfacing.test.ts`. A failed WRITE must reach the caller; the
 * bug class is an action that fires a write, never reads the result,
 * and reports success while the rows are gone.
 *
 * `saveEvent` is the highest-value instance: it replaces every child
 * collection as delete-then-insert. Both halves fan out through
 * `Promise.all`, so an unchecked batch loses age groups / sponsors /
 * levels / surfaces / features / images / milestones on a "saved"
 * event — and the delete half landing while the insert half fails is
 * exactly how the collection disappears.
 *
 * Failures are genuine PostgREST errors: the proxy re-points ONE
 * table, for ONE verb, at a nonexistent relation. Scoping to the verb
 * is what lets the delete batch and the insert batch be pinned
 * separately — breaking the table outright would always trip the
 * delete first and leave the insert batch untested.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const ctl = vi.hoisted(() => ({
  breakTable: null as string | null,
  breakVerb: null as "insert" | "delete" | null,
  client: null as SupabaseClient | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => {
  const wrap = (real: SupabaseClient): SupabaseClient =>
    new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "from") {
          return (table: string) => {
            const healthy = target.from(table);
            if (ctl.breakTable !== table) return healthy;
            const missing = target.from(`${table}_we_missing`);
            if (!ctl.breakVerb) return missing;
            // Break only the named verb so the other half of the
            // replace-all still runs against the real table.
            return new Proxy(healthy, {
              get(builder, method) {
                if (method === ctl.breakVerb) {
                  return (...args: unknown[]) =>
                    (missing as unknown as Record<string, (...a: unknown[]) => unknown>)[
                      method as string
                    ](...args);
                }
                const value = Reflect.get(builder, method);
                return typeof value === "function" ? value.bind(builder) : value;
              },
            });
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as SupabaseClient;
  return {
    createServerAuthClient: async () => wrap(ctl.client!),
    createAnonServerClient: () => wrap(ctl.client!),
  };
});

import { saveEvent, duplicateEvent } from "@/app/dashboard/events/event-actions";

let edId = "";
let eventId = "";
let tournamentId = "";

/** An update-intent save carrying one age group and one surface. */
function saveForm(): FormData {
  const fd = new FormData();
  fd.set("intent", "update");
  fd.set("event_id", eventId);
  fd.set("title", "Probe Event Renamed");
  fd.set(
    "age_groups",
    JSON.stringify([
      { team_gender: "boys", age: "U12", price: 500, field_size: "11v11" },
    ]),
  );
  fd.set("surfaces", JSON.stringify(["grass"]));
  return fd;
}

beforeAll(async () => {
  const user = await createUser({
    metadata: { user_type: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  edId = user.id;
  ctl.client = user.client;
  const seeded = await seedTournamentAndEvent(user.client);
  eventId = seeded.eventId;
  tournamentId = seeded.tournamentId;
});

afterAll(async () => {
  const svc = service();
  await svc.from("events").delete().eq("tournament_id", tournamentId);
  await svc.from("tournaments").delete().eq("id", tournamentId);
  await purge([edId]);
});

beforeEach(() => {
  ctl.breakTable = null;
  ctl.breakVerb = null;
});

describe("write-error-surfacing · saveEvent child collections", () => {
  it("sanity: a healthy save reports success AND the child rows land", async () => {
    const result = await saveEvent({}, saveForm());
    expect(result.error).toBeUndefined();
    expect(result.createdId).toBe(eventId);

    const svc = service();
    const { data: ages } = await svc
      .from("event_age_groups")
      .select("age")
      .eq("event_id", eventId);
    expect(ages).toHaveLength(1);
    const { data: surfaces } = await svc
      .from("event_surfaces")
      .select("surface")
      .eq("event_id", eventId);
    expect(surfaces).toHaveLength(1);
  });

  it("a failed child DELETE surfaces instead of reporting a clean save", async () => {
    ctl.breakTable = "event_age_groups";
    ctl.breakVerb = "delete";
    const result = await saveEvent({}, saveForm());
    expect(result.error).toBeTruthy();
    expect(result.createdId).toBeUndefined();
  });

  it("a failed child INSERT surfaces — the delete already wiped the rows", async () => {
    ctl.breakTable = "event_age_groups";
    ctl.breakVerb = "insert";
    const result = await saveEvent({}, saveForm());
    expect(result.error).toBeTruthy();
    expect(result.createdId).toBeUndefined();

    // The data loss the silent path used to hide: the delete landed,
    // the insert did not, so the collection is empty. Reporting the
    // failure is what lets the ED know to re-enter it.
    const { data: ages } = await service()
      .from("event_age_groups")
      .select("age")
      .eq("event_id", eventId);
    expect(ages).toHaveLength(0);
  });

  it("a failed INSERT on a sibling collection surfaces too (class, not instance)", async () => {
    ctl.breakTable = "event_surfaces";
    ctl.breakVerb = "insert";
    const result = await saveEvent({}, saveForm());
    expect(result.error).toBeTruthy();
    expect(result.createdId).toBeUndefined();
  });
});

describe("write-error-surfacing · duplicateEvent child collections", () => {
  it("sanity: a healthy duplicate runs through to its redirect", async () => {
    await saveEvent({}, saveForm());
    await expect(duplicateEvent(eventId)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("a failed child READ surfaces instead of silently dropping the collection", async () => {
    ctl.breakTable = "event_age_groups";
    const result = await duplicateEvent(eventId);
    expect(result?.error).toBeTruthy();
  });

  it("a failed child INSERT surfaces instead of redirecting to a half-copied event", async () => {
    ctl.breakTable = "event_age_groups";
    ctl.breakVerb = "insert";
    const result = await duplicateEvent(eventId);
    expect(result?.error).toBeTruthy();
  });
});
