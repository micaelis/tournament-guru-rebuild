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
  breakVerb: null as "insert" | "update" | "delete" | null,
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
import { upsertFaq } from "@/app/dashboard/faqs/actions";
import { updateTeams } from "@/app/dashboard/account/actions";

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

describe("write-error-surfacing · faq_audiences replace-all", () => {
  let adminId = "";
  let restore: SupabaseClient | null = null;

  beforeAll(async () => {
    const admin = await createUser({
      becomeAdmin: true,
      completeOnboarding: true,
      role: "admin",
    });
    adminId = admin.id;
    restore = ctl.client;
    ctl.client = admin.client;
  });

  afterAll(async () => {
    ctl.client = restore;
    await service().from("faqs").delete().eq("created_by", adminId);
    await purge([adminId]);
  });

  function faqForm(id?: string): FormData {
    const fd = new FormData();
    if (id) fd.set("id", id);
    fd.set("title", "Probe FAQ");
    fd.set("content", "Probe body.");
    fd.set("status", "draft");
    fd.set("sort_order", "0");
    fd.set(
      "audiences",
      JSON.stringify([{ user_type: "attendee", role_title: null }]),
    );
    return fd;
  }

  it("sanity: a healthy create writes the FAQ and its audience row", async () => {
    const result = await upsertFaq({}, faqForm());
    expect(result.error).toBeUndefined();

    const svc = service();
    const { data: faqs } = await svc
      .from("faqs")
      .select("id")
      .eq("created_by", adminId);
    expect(faqs).toHaveLength(1);
    const { data: auds } = await svc
      .from("faq_audiences")
      .select("user_type")
      .eq("faq_id", faqs![0].id);
    expect(auds).toHaveLength(1);
  });

  it("a failed audience INSERT surfaces — the FAQ would be visible to nobody", async () => {
    ctl.breakTable = "faq_audiences";
    ctl.breakVerb = "insert";
    const result = await upsertFaq({}, faqForm());
    expect(result.error).toBeTruthy();
  });

  it("a failed audience DELETE surfaces on edit — stale targeting would survive", async () => {
    const { data: faqs } = await service()
      .from("faqs")
      .select("id")
      .eq("created_by", adminId)
      .limit(1);
    ctl.breakTable = "faq_audiences";
    ctl.breakVerb = "delete";
    const result = await upsertFaq({}, faqForm(faqs![0].id));
    expect(result.error).toBeTruthy();
  });
});

describe("write-error-surfacing · updateTeams distance_pref", () => {
  let attendeeId = "";
  let restore: SupabaseClient | null = null;

  beforeAll(async () => {
    const attendee = await createUser({
      completeOnboarding: true,
      role: "coach",
    });
    attendeeId = attendee.id;
    restore = ctl.client;
    ctl.client = attendee.client;
  });

  afterAll(async () => {
    ctl.client = restore;
    await purge([attendeeId]);
  });

  function teamsForm(): FormData {
    const fd = new FormData();
    fd.set("distance_pref", "miles_300");
    fd.set("team_1_gender", "boys");
    fd.set("team_1_age", "U12");
    fd.set("team_1_level", "middle");
    return fd;
  }

  it("sanity: a healthy save persists distance_pref AND the team row", async () => {
    const result = await updateTeams({}, teamsForm());
    expect(result.error).toBeUndefined();

    const svc = service();
    const { data: profile } = await svc
      .from("profiles")
      .select("distance_pref")
      .eq("id", attendeeId)
      .single<{ distance_pref: string }>();
    expect(profile!.distance_pref).toBe("miles_300");
    const { data: teams } = await svc
      .from("user_teams")
      .select("slot")
      .eq("profile_id", attendeeId);
    expect(teams).toHaveLength(1);
  });

  it("a failed distance_pref write surfaces instead of reporting 'Team info updated.'", async () => {
    ctl.breakTable = "profiles";
    ctl.breakVerb = "update";
    const result = await updateTeams({}, teamsForm());
    expect(result.error).toBeTruthy();
    expect(result.info).toBeUndefined();
  });

  // Deliberately the CLEAR-ALL case (no team fields submitted, so no
  // insert follows). With a slot still filled, the re-insert collides
  // with the surviving row on the unique-slot index and the already
  // checked insert reports that error — which would let this pass
  // against unchecked-delete code. Clear-all leaves the delete as the
  // only write, so nothing else can raise the error for it.
  it("a failed slot DELETE surfaces on clear-all instead of stranding the old teams", async () => {
    await updateTeams({}, teamsForm());
    expect(
      (await service().from("user_teams").select("slot").eq("profile_id", attendeeId))
        .data,
    ).toHaveLength(1);

    const clearAll = new FormData();
    clearAll.set("distance_pref", "miles_300");

    ctl.breakTable = "user_teams";
    ctl.breakVerb = "delete";
    const result = await updateTeams({}, clearAll);
    expect(result.error).toBeTruthy();
    expect(result.info).toBeUndefined();
  });
});
