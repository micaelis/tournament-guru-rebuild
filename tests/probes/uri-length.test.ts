/**
 * URI-length probe (S11.6) — PostgREST `.in()` filters ride the GET
 * query string and the HTTP client caps URIs at ~8 KB, so an id list
 * of a few hundred UUIDs kills the request with "URI too long". Found
 * live: the admin Events dashboard crashed once the local DB reached
 * 247 tournaments. Unbounded id lists must batch through
 * lib/supabase/in-chunks; this probe drives the original crash site
 * with 260 tournaments and pins the cross-batch sort contract.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createUser, purge, service } from "../harness";

vi.mock("@/lib/supabase/server", async () => {
  const { anon } = await import("../harness");
  return {
    createAnonServerClient: () => anon(),
    createServerAuthClient: async () => anon(),
  };
});

import { listEventsForTournaments } from "@/app/dashboard/events/event-queries";
import { chunkIds, IN_CHUNK_SIZE } from "@/lib/supabase/in-chunks";

const COUNT = 260; // > IN_CHUNK_SIZE and > the observed ~220-id failure point
const users: string[] = [];
let tournamentIds: string[] = [];

beforeAll(async () => {
  const svc = service();
  const ed = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  users.push(ed.id);

  const { data, error } = await svc
    .from("tournaments")
    .insert(
      Array.from({ length: COUNT }, (_, i) => ({
        title: `URIProbe Cup ${i}`,
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
      })),
    )
    .select("id");
  if (error) throw new Error(`seed tournaments: ${error.message}`);
  tournamentIds = (data ?? []).map((r) => r.id as string);

  // Three events spread across the FIRST and LAST batch, with the
  // earliest start date living in the last batch — proves rows from a
  // later batch still sort to the front of the merged list.
  const seedEvent = (tIdx: number, n: number, start: string) => ({
    tournament_id: tournamentIds[tIdx],
    owner_id: ed.id,
    created_by: ed.id,
    claimed: true,
    title: `URIProbe Event ${n}`,
    lifecycle: "active",
    start_date: start,
    end_date: start,
  });
  const { error: evErr } = await svc.from("events").insert([
    seedEvent(0, 1, "2026-09-10"),
    seedEvent(1, 2, "2026-09-20"),
    seedEvent(COUNT - 1, 3, "2026-09-01"),
  ]);
  if (evErr) throw new Error(`seed events: ${evErr.message}`);
});

afterAll(async () => {
  const svc = service();
  await svc.from("events").delete().like("title", "URIProbe Event %");
  await svc.from("tournaments").delete().like("title", "URIProbe Cup %");
  await purge(users);
});

describe("URI length · unbounded id lists batch through in-chunks", () => {
  it("sanity: the fixture exceeds one chunk and the old failure point", () => {
    expect(COUNT).toBeGreaterThan(IN_CHUNK_SIZE);
    expect(COUNT).toBeGreaterThan(220);
  });

  it("listEventsForTournaments survives every tournament id at once (admin scope)", async () => {
    const rows = await listEventsForTournaments(tournamentIds);
    const titles = rows
      .filter((r) => r.title.startsWith("URIProbe Event"))
      .map((r) => r.title);
    expect(titles).toHaveLength(3);
    // Cross-batch sort: the last-batch event has the earliest start.
    expect(titles[0]).toBe("URIProbe Event 3");
    expect(titles[1]).toBe("URIProbe Event 1");
    expect(titles[2]).toBe("URIProbe Event 2");
  });

  it("chunkIds covers the edges", () => {
    expect(chunkIds([])).toEqual([]);
    expect(chunkIds(Array.from({ length: IN_CHUNK_SIZE }, (_, i) => i))).toHaveLength(1);
    const two = chunkIds(Array.from({ length: IN_CHUNK_SIZE + 1 }, (_, i) => i));
    expect(two).toHaveLength(2);
    expect(two[0]).toHaveLength(IN_CHUNK_SIZE);
    expect(two[1]).toHaveLength(1);
  });
});
