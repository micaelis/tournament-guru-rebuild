/**
 * Round-2 #7 — the search gender filter treats "both" as a union
 * value, not an opaque tag:
 *   - selecting Both matches boys-, girls-, AND both-tagged events
 *     (previously it only matched rows literally tagged 'both' and
 *     returned nothing on the seeded data)
 *   - a coed ("both"-tagged) event satisfies a Boys or Girls search
 *   - Boys still excludes girls-only events and vice versa
 *
 * Drives the real `searchEvents` against the local stack; the server
 * client factory is mocked to the harness anon client.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

vi.mock("@/lib/supabase/server", async () => {
  const { anon } = await import("../harness");
  return { createAnonServerClient: () => anon() };
});

import { searchEvents } from "@/lib/events/search";

const marker = `GdrBoth ${randomUUID().slice(0, 6)}`;
let userId = "";
const tournamentIds: string[] = [];
let boysEventId = "";
let girlsEventId = "";
let coedEventId = "";

beforeAll(async () => {
  const ed = await createUser({ completeOnboarding: true, role: "event_director" });
  userId = ed.id;
  const svc = service();
  const seedOne = async (tag: "boys" | "girls" | "both") => {
    const { tournamentId, eventId } = await seedTournamentAndEvent(ed.client);
    tournamentIds.push(tournamentId);
    const upd = await svc
      .from("events")
      .update({ title: `${marker} ${tag} cup` })
      .eq("id", eventId);
    if (upd.error) throw new Error(upd.error.message);
    const ins = await svc
      .from("event_age_groups")
      .insert({
        event_id: eventId,
        age: "U12",
        team_gender: tag,
        price: 0,
        field_size: "7v7",
      });
    if (ins.error) throw new Error(ins.error.message);
    return eventId;
  };
  boysEventId = await seedOne("boys");
  girlsEventId = await seedOne("girls");
  coedEventId = await seedOne("both");
});

afterAll(async () => {
  const svc = service();
  for (const id of tournamentIds) {
    await svc.from("events").delete().eq("tournament_id", id);
    await svc.from("tournaments").delete().eq("id", id);
  }
  await purge([userId]);
});

async function idsFor(genders: string[]) {
  const res = await searchEvents({ q: marker, genders });
  return res.data.map((e) => e.id);
}

describe("search gender filter — 'both' union semantics", () => {
  it("Both matches boys-, girls-, and both-tagged events", async () => {
    const ids = await idsFor(["both"]);
    expect(ids).toContain(boysEventId);
    expect(ids).toContain(girlsEventId);
    expect(ids).toContain(coedEventId);
  });

  it("Girls matches girls-tagged and coed events, not boys-only", async () => {
    const ids = await idsFor(["girls"]);
    expect(ids).toContain(girlsEventId);
    expect(ids).toContain(coedEventId);
    expect(ids).not.toContain(boysEventId);
  });

  it("Boys matches boys-tagged and coed events, not girls-only", async () => {
    const ids = await idsFor(["boys"]);
    expect(ids).toContain(boysEventId);
    expect(ids).toContain(coedEventId);
    expect(ids).not.toContain(girlsEventId);
  });

  it("no gender filter still returns all three (control)", async () => {
    const ids = await idsFor([]);
    expect(ids).toEqual(
      expect.arrayContaining([boysEventId, girlsEventId, coedEventId]),
    );
  });
});
