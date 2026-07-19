/**
 * save_event_graph — the atomic event-graph RPC (S9.3 rework).
 *
 * Two contracts under test, driven straight through PostgREST `rpc()`
 * (below the server action, so the action's validation can't mask a
 * DB-side hole):
 *
 * 1. AUTHZ mirrors p_events_write (S10.1/S10.2/S1.1): event host only,
 *    owner-or-admin on the existing row, write access to the parent
 *    tournament (current AND final), anon rejected outright. The
 *    cross-owner case seeds an event whose owner and parent-tournament
 *    owner DIFFER (the S10.2 graft aftermath) so the owner guard is
 *    isolated from the parent guard — a caller who owns the tournament
 *    but not the event must still be rejected.
 *
 * 2. ATOMICITY: a failure on the LAST child collection (milestones)
 *    rolls back the base row and every earlier collection — the proof
 *    the old in-action replace-all could never pass, because its
 *    deletes had already landed when the late insert died.
 *
 * Anon is layered out four deep (EXECUTE revoke, null-uid raise, role
 * guard, parent guard): removing any one layer leaves the probe green,
 * by design (S10.3 layering). The mutation-flippable tripwires are the
 * role, owner, parent, and atomicity cases.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createUser, purge, service } from "../harness";
import type { SupabaseClient } from "@supabase/supabase-js";

const users: string[] = [];
const tournaments: string[] = [];

let edA: { id: string; client: SupabaseClient };
let edB: { id: string; client: SupabaseClient };
let attendee: { id: string; client: SupabaseClient };
let admin: { id: string; client: SupabaseClient };
let tournamentA = "";
let tournamentB = "";
let attendeeTournament = "";

function basePayload(tournamentId: string, extra: Record<string, unknown> = {}) {
  return {
    id: null,
    tournament_id: tournamentId,
    lifecycle: "draft",
    title: "Graph Probe Event",
    age_groups: [
      { team_gender: "boys", age: "U12", price: 500, field_size: "11v11" },
    ],
    sponsors: [],
    competition_levels: ["middle"],
    surfaces: ["grass"],
    features: [],
    images: ["https://example.com/a.png"],
    milestones: [{ title: "Kickoff", milestone_date: null, description: null }],
    ...extra,
  };
}

async function seedTournament(ownerId: string): Promise<string> {
  const { data, error } = await service()
    .from("tournaments")
    .insert({
      title: `Graph Cup ${ownerId.slice(0, 6)}`,
      owner_id: ownerId,
      created_by: ownerId,
      claimed: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  tournaments.push(data!.id);
  return data!.id;
}

beforeAll(async () => {
  const mkEd = async () => {
    const u = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(u.id);
    return u;
  };
  edA = await mkEd();
  edB = await mkEd();
  attendee = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  users.push(attendee.id);
  admin = await createUser({ becomeAdmin: true, completeOnboarding: true });
  users.push(admin.id);

  tournamentA = await seedTournament(edA.id);
  tournamentB = await seedTournament(edB.id);
  // An attendee "owning" a tournament isolates the role guard: every
  // ownership predicate passes, so only is_event_host() can reject.
  attendeeTournament = await seedTournament(attendee.id);
});

afterAll(async () => {
  const svc = service();
  for (const t of tournaments) {
    await svc.from("events").delete().eq("tournament_id", t);
    await svc.from("tournaments").delete().eq("id", t);
  }
  await purge(users);
});

describe("save_event_graph · authz mirrors p_events_write", () => {
  it("anon is rejected and writes nothing", async () => {
    const { data, error } = await anon().rpc("save_event_graph", {
      p_event: basePayload(tournamentA),
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    const { data: rows } = await service()
      .from("events")
      .select("id")
      .eq("tournament_id", tournamentA);
    expect(rows ?? []).toHaveLength(0);
  });

  it("an attendee is rejected even on a tournament they own (role guard)", async () => {
    const { error } = await attendee.client.rpc("save_event_graph", {
      p_event: basePayload(attendeeTournament),
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
    const { data: rows } = await service()
      .from("events")
      .select("id")
      .eq("tournament_id", attendeeTournament);
    expect(rows ?? []).toHaveLength(0);
  });

  it("an ED cannot INSERT into another ED's tournament (parent gate)", async () => {
    const { error } = await edB.client.rpc("save_event_graph", {
      p_event: basePayload(tournamentA),
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("an ED cannot UPDATE an event they don't own, even inside their own tournament (owner guard)", async () => {
    // The S10.2 graft aftermath: edA's event parked in edB's tournament.
    // edB passes both parent checks, so only the owner guard stands.
    const { data: grafted, error: seedError } = await service()
      .from("events")
      .insert({
        tournament_id: tournamentB,
        owner_id: edA.id,
        created_by: edA.id,
        claimed: true,
        title: "Grafted Event",
        lifecycle: "draft",
      })
      .select("id")
      .single<{ id: string }>();
    expect(seedError).toBeNull();

    const { error } = await edB.client.rpc("save_event_graph", {
      p_event: basePayload(tournamentB, {
        id: grafted!.id,
        title: "Hijacked",
      }),
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");

    const { data: after } = await service()
      .from("events")
      .select("title")
      .eq("id", grafted!.id)
      .single<{ title: string }>();
    expect(after?.title).toBe("Grafted Event");
    await service().from("events").delete().eq("id", grafted!.id);
  });

  it("the owning ED can create, then update, with the graph landing", async () => {
    const { data: createdId, error: createError } = await edA.client.rpc(
      "save_event_graph",
      { p_event: basePayload(tournamentA) },
    );
    expect(createError).toBeNull();
    const eventId = createdId as string;

    const svc = service();
    const { data: row } = await svc
      .from("events")
      .select("owner_id, claimed, lifecycle")
      .eq("id", eventId)
      .single<{ owner_id: string; claimed: boolean; lifecycle: string }>();
    expect(row?.owner_id).toBe(edA.id);
    expect(row?.claimed).toBe(true);
    expect(row?.lifecycle).toBe("draft");
    const { data: ages } = await svc
      .from("event_age_groups")
      .select("age")
      .eq("event_id", eventId);
    expect(ages).toHaveLength(1);
    const { data: miles } = await svc
      .from("event_milestones")
      .select("title, sort_order")
      .eq("event_id", eventId);
    expect(miles).toEqual([{ title: "Kickoff", sort_order: 0 }]);

    // Update with lifecycle omitted: the title changes, lifecycle keeps.
    const { error: updateError } = await edA.client.rpc("save_event_graph", {
      p_event: basePayload(tournamentA, {
        id: eventId,
        lifecycle: null,
        title: "Graph Probe Renamed",
      }),
    });
    expect(updateError).toBeNull();
    const { data: after } = await svc
      .from("events")
      .select("title, lifecycle")
      .eq("id", eventId)
      .single<{ title: string; lifecycle: string }>();
    expect(after?.title).toBe("Graph Probe Renamed");
    expect(after?.lifecycle).toBe("draft");
    await svc.from("events").delete().eq("id", eventId);
  });

  it("an admin create lands unclaimed and claimable (S1.1)", async () => {
    const { data: createdId, error } = await admin.client.rpc(
      "save_event_graph",
      { p_event: basePayload(tournamentA, { title: "Admin Created" }) },
    );
    expect(error).toBeNull();
    const { data: row } = await service()
      .from("events")
      .select("owner_id, claimed, created_by")
      .eq("id", createdId as string)
      .single<{ owner_id: string | null; claimed: boolean; created_by: string }>();
    expect(row?.owner_id).toBeNull();
    expect(row?.claimed).toBe(false);
    expect(row?.created_by).toBe(admin.id);
    await service().from("events").delete().eq("id", createdId as string);
  });
});

describe("save_event_graph · atomicity", () => {
  it("a late child failure (milestones) rolls back the base row AND earlier collections", async () => {
    // Seed a healthy graph.
    const { data: createdId, error: seedError } = await edA.client.rpc(
      "save_event_graph",
      {
        p_event: basePayload(tournamentA, {
          title: "Atomic Before",
          sponsors: [
            { name: "Acme", link: "https://acme.test", logo_url: "https://acme.test/l.png" },
          ],
        }),
      },
    );
    expect(seedError).toBeNull();
    const eventId = createdId as string;

    // Poisoned payload: everything valid EXCEPT the last collection —
    // a milestone with a null title violates NOT NULL after the base
    // update and every earlier replace-all have already run.
    const { error } = await edA.client.rpc("save_event_graph", {
      p_event: basePayload(tournamentA, {
        id: eventId,
        lifecycle: null,
        title: "Atomic After",
        age_groups: [
          { team_gender: "girls", age: "U14", price: 900, field_size: "9v9" },
        ],
        sponsors: [],
        images: ["https://example.com/b.png", "https://example.com/c.png"],
        milestones: [{ title: null, milestone_date: null, description: null }],
      }),
    });
    expect(error).not.toBeNull();

    // Nothing moved: base row and every collection read exactly as
    // seeded — the old replace-all left the collections wiped here.
    const svc = service();
    const { data: row } = await svc
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single<{ title: string }>();
    expect(row?.title).toBe("Atomic Before");
    const { data: ages } = await svc
      .from("event_age_groups")
      .select("team_gender, age, price")
      .eq("event_id", eventId);
    expect(ages).toEqual([{ team_gender: "boys", age: "U12", price: 500 }]);
    const { data: sponsors } = await svc
      .from("sponsors")
      .select("name")
      .eq("event_id", eventId);
    expect(sponsors).toEqual([{ name: "Acme" }]);
    const { data: images } = await svc
      .from("event_images")
      .select("url")
      .eq("event_id", eventId);
    expect(images).toEqual([{ url: "https://example.com/a.png" }]);
    const { data: miles } = await svc
      .from("event_milestones")
      .select("title")
      .eq("event_id", eventId);
    expect(miles).toEqual([{ title: "Kickoff" }]);

    await svc.from("events").delete().eq("id", eventId);
  });
});
