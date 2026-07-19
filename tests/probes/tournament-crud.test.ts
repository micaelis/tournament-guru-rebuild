/**
 * Tournament (and child-event) CRUD across the role × operation matrix.
 *
 * This is the coverage the event-edit break exposed: the edit path had no
 * test at all, so a grant-denied `upsert` shipped and every ED edit and
 * publish-a-draft failed in production (S9.2). This probe pins the whole
 * lifecycle — create, read/list scoping, update, delete — for ED-owner,
 * ED-non-owner, Admin, Attendee, and Anon.
 *
 * Split of duty, per the TESTING.md convention:
 *   - authorization + invariants live here (DB layer, no browser)
 *   - the UI affordances live in e2e/tournament-crud.spec.ts
 *   - the two authz holes found while writing this have their own
 *     dedicated probes: event-host-write-gate (S10.1, attendee/anon
 *     cannot host) and event-parent-tournament-gate (S10.2, cross-ED
 *     grafting). They are referenced from the matrix rather than
 *     duplicated here.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anon, createUser, purge, service } from "../harness";

const ctl = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerAuthClient: async () => ctl.client!,
  createAnonServerClient: () => ctl.client!,
}));

import {
  createTournament,
  deleteTournament,
  updateTournament,
} from "@/app/dashboard/events/actions";

const users: string[] = [];
const tournaments: string[] = [];

type Actor = { id: string; client: SupabaseClient };
let edOwner: Actor;
let edOther: Actor;
let admin: Actor;
let attendee: Actor;

/** Run a server action as `actor` (the actions read the mocked client). */
async function as<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  ctl.client = actor.client;
  return fn();
}

async function track(id: string): Promise<string> {
  tournaments.push(id);
  return id;
}

async function seedTournament(
  ownerId: string | null,
  createdBy: string,
  title: string,
): Promise<string> {
  const { data } = await service()
    .from("tournaments")
    .insert({
      title,
      owner_id: ownerId,
      created_by: createdBy,
      claimed: ownerId !== null,
    })
    .select("id")
    .single<{ id: string }>();
  return track(data!.id);
}

async function seedEvent(
  tournamentId: string,
  ownerId: string | null,
  createdBy: string,
  opts: { title?: string; lifecycle?: "draft" | "active" } = {},
): Promise<string> {
  const { data } = await service()
    .from("events")
    .insert({
      tournament_id: tournamentId,
      owner_id: ownerId,
      created_by: createdBy,
      claimed: ownerId !== null,
      title: opts.title ?? "Matrix Event",
      lifecycle: opts.lifecycle ?? "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    })
    .select("id")
    .single<{ id: string }>();
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
  edOwner = await mkEd();
  edOther = await mkEd();
  admin = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    becomeAdmin: true,
    completeOnboarding: true,
    role: "coach",
  });
  users.push(admin.id);
  attendee = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  users.push(attendee.id);
});

afterAll(async () => {
  const svc = service();
  for (const id of tournaments) {
    await svc.from("events").delete().eq("tournament_id", id);
    await svc.from("tournaments").delete().eq("id", id);
  }
  await purge(users);
});

// ── Create ───────────────────────────────────────────────────────────

describe("CRUD · create", () => {
  it("ED-owner: createTournament stamps them as owner and marks it claimed", async () => {
    const fd = new FormData();
    fd.set("title", "ED Owned Cup");
    const result = await as(edOwner, () => createTournament({}, fd));

    expect(result.error).toBeUndefined();
    expect(result.createdId).toBeTruthy();
    await track(result.createdId!);

    const { data } = await service()
      .from("tournaments")
      .select("owner_id, created_by, claimed")
      .eq("id", result.createdId!)
      .single<{ owner_id: string; created_by: string; claimed: boolean }>();
    expect(data!.owner_id).toBe(edOwner.id);
    expect(data!.created_by).toBe(edOwner.id);
    expect(data!.claimed).toBe(true);
  });

  it("Admin: createTournament leaves it unclaimed so an ED can claim it (S1.1)", async () => {
    const fd = new FormData();
    fd.set("title", "Admin Unowned Cup");
    const result = await as(admin, () => createTournament({}, fd));

    expect(result.error).toBeUndefined();
    await track(result.createdId!);

    const { data } = await service()
      .from("tournaments")
      .select("owner_id, created_by, claimed")
      .eq("id", result.createdId!)
      .single<{ owner_id: string | null; created_by: string; claimed: boolean }>();
    expect(data!.owner_id).toBeNull();
    expect(data!.created_by).toBe(admin.id);
    expect(data!.claimed).toBe(false);
  });

  it("Attendee: createTournament is refused, and no row lands", async () => {
    const fd = new FormData();
    fd.set("title", "Attendee Cup");
    const result = await as(attendee, () => createTournament({}, fd));

    expect(result.error).toBeTruthy();
    expect(result.createdId).toBeUndefined();
    const { data } = await service()
      .from("tournaments")
      .select("id")
      .eq("created_by", attendee.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("create validation: an empty title is rejected before any write", async () => {
    const fd = new FormData();
    fd.set("title", "   ");
    const result = await as(edOwner, () => createTournament({}, fd));

    expect(result.fieldErrors?.title).toBeTruthy();
    expect(result.createdId).toBeUndefined();
  });
});

// ── Read / list ──────────────────────────────────────────────────────

describe("CRUD · read / list", () => {
  it("tournament rows are public-read by every role (visibility gates on events)", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Public Read Cup");
    const readers: [string, SupabaseClient][] = [
      ["ed-non-owner", edOther.client],
      ["attendee", attendee.client],
      ["anon", anon()],
    ];
    for (const [label, client] of readers) {
      const { data } = await client
        .from("tournaments")
        .select("id")
        .eq("id", tId);
      expect(data ?? [], label).toHaveLength(1);
    }
  });

  it("ED-owner sees their own DRAFT event; ED-non-owner, attendee and anon do not", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Draft Vis Cup");
    const draftId = await seedEvent(tId, edOwner.id, edOwner.id, {
      title: "Hidden Draft",
      lifecycle: "draft",
    });

    const { data: ownerSees } = await edOwner.client
      .from("events")
      .select("id")
      .eq("id", draftId);
    expect(ownerSees ?? []).toHaveLength(1);

    for (const [label, client] of [
      ["ed-non-owner", edOther.client],
      ["attendee", attendee.client],
      ["anon", anon()],
    ] as [string, SupabaseClient][]) {
      const { data } = await client.from("events").select("id").eq("id", draftId);
      expect(data ?? [], label).toHaveLength(0);
    }

    const { data: adminSees } = await admin.client
      .from("events")
      .select("id")
      .eq("id", draftId);
    expect(adminSees ?? []).toHaveLength(1);
  });

  it("a published event is readable by every role including anon", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Published Vis Cup");
    const liveId = await seedEvent(tId, edOwner.id, edOwner.id, {
      title: "Visible Live",
      lifecycle: "active",
    });

    for (const [label, client] of [
      ["ed-owner", edOwner.client],
      ["ed-non-owner", edOther.client],
      ["admin", admin.client],
      ["attendee", attendee.client],
      ["anon", anon()],
    ] as [string, SupabaseClient][]) {
      const { data } = await client.from("events").select("id").eq("id", liveId);
      expect(data ?? [], label).toHaveLength(1);
    }
  });
});

// ── Update ───────────────────────────────────────────────────────────

describe("CRUD · update", () => {
  it("ED-owner: updateTournament persists the rename", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Before Rename");
    const fd = new FormData();
    fd.set("id", tId);
    fd.set("title", "After Rename");
    const result = await as(edOwner, () => updateTournament({}, fd));

    expect(result.error).toBeUndefined();
    const { data } = await service()
      .from("tournaments")
      .select("title")
      .eq("id", tId)
      .single<{ title: string }>();
    expect(data!.title).toBe("After Rename");
  });

  it("ED-non-owner: an update against another ED's tournament changes nothing", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Not Yours");
    const fd = new FormData();
    fd.set("id", tId);
    fd.set("title", "Hijacked");
    await as(edOther, () => updateTournament({}, fd));

    const { data } = await service()
      .from("tournaments")
      .select("title")
      .eq("id", tId)
      .single<{ title: string }>();
    expect(data!.title).toBe("Not Yours");
  });

  it("Attendee and anon cannot update a tournament", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Locked Cup");
    await attendee.client
      .from("tournaments")
      .update({ title: "Attendee Edit" })
      .eq("id", tId);
    await anon().from("tournaments").update({ title: "Anon Edit" }).eq("id", tId);

    const { data } = await service()
      .from("tournaments")
      .select("title")
      .eq("id", tId)
      .single<{ title: string }>();
    expect(data!.title).toBe("Locked Cup");
  });

  it("Admin: can update an UNCLAIMED tournament (the S1.1-permitted case)", async () => {
    const tId = await seedTournament(null, admin.id, "Admin Unclaimed");
    const fd = new FormData();
    fd.set("id", tId);
    fd.set("title", "Admin Renamed");
    const result = await as(admin, () => updateTournament({}, fd));

    expect(result.error).toBeUndefined();
    const { data } = await service()
      .from("tournaments")
      .select("title")
      .eq("id", tId)
      .single<{ title: string }>();
    expect(data!.title).toBe("Admin Renamed");
  });

  it("update validation: an empty title is rejected and the row is untouched", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Keep This Title");
    const fd = new FormData();
    fd.set("id", tId);
    fd.set("title", "");
    const result = await as(edOwner, () => updateTournament({}, fd));

    expect(result.fieldErrors?.title).toBeTruthy();
    const { data } = await service()
      .from("tournaments")
      .select("title")
      .eq("id", tId)
      .single<{ title: string }>();
    expect(data!.title).toBe("Keep This Title");
  });
});

// ── Delete ───────────────────────────────────────────────────────────

describe("CRUD · delete", () => {
  it("ED-owner: delete cascades child events and DETACHES their reviews with a snapshot", async () => {
    const svc = service();
    const tId = await seedTournament(edOwner.id, edOwner.id, "Snapshot Cup");
    const eId = await seedEvent(tId, edOwner.id, edOwner.id, {
      title: "Reviewed Event",
    });

    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
    });
    users.push(coach.id);
    const { data: review } = await svc
      .from("reviews")
      .insert({
        event_id: eId,
        author_id: coach.id,
        status: "published",
        review_title: "Kept After Delete",
        review_body: "This review must survive the event being deleted.",
        rating_fields: 4,
        rating_facilities: 4,
        rating_management: 4,
        rating_competition: 4,
        rating_diversity: 4,
        rating_cost_value: 4,
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    const result = await as(edOwner, () => deleteTournament(tId));
    expect(result.error).toBeUndefined();

    // Tournament + child event are gone.
    const { data: t } = await svc.from("tournaments").select("id").eq("id", tId);
    expect(t ?? []).toHaveLength(0);
    const { data: e } = await svc.from("events").select("id").eq("id", eId);
    expect(e ?? []).toHaveLength(0);

    // The review survives, detached, carrying the event snapshot.
    const { data: r } = await svc
      .from("reviews")
      .select("id, detached, event_id, snapshot_event_title, snapshot_tournament_title")
      .eq("id", review!.id)
      .single<{
        id: string;
        detached: boolean;
        event_id: string | null;
        snapshot_event_title: string | null;
        snapshot_tournament_title: string | null;
      }>();
    expect(r!.detached).toBe(true);
    expect(r!.event_id).toBeNull();
    expect(r!.snapshot_event_title).toBe("Reviewed Event");
    expect(r!.snapshot_tournament_title).toBe("Snapshot Cup");

    await svc.from("reviews").delete().eq("id", review!.id);
  });

  it("ED-non-owner: delete_tournament is refused and the row survives", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Undeletable Cup");
    const result = await as(edOther, () => deleteTournament(tId));

    expect(result.error).toBeTruthy();
    const { data } = await service().from("tournaments").select("id").eq("id", tId);
    expect(data ?? []).toHaveLength(1);
  });

  it("Attendee: delete_tournament is refused and the row survives", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Attendee Safe Cup");
    const result = await as(attendee, () => deleteTournament(tId));

    expect(result.error).toBeTruthy();
    const { data } = await service().from("tournaments").select("id").eq("id", tId);
    expect(data ?? []).toHaveLength(1);
  });

  it("Anon: the delete RPC is refused and the row survives", async () => {
    const tId = await seedTournament(edOwner.id, edOwner.id, "Anon Safe Cup");
    const { error } = await anon().rpc("delete_tournament", {
      target_tournament: tId,
    });

    expect(error).not.toBeNull();
    const { data } = await service().from("tournaments").select("id").eq("id", tId);
    expect(data ?? []).toHaveLength(1);
  });

  it("Admin: can delete a tournament", async () => {
    const tId = await seedTournament(null, admin.id, "Admin Deletable Cup");
    const result = await as(admin, () => deleteTournament(tId));

    expect(result.error).toBeUndefined();
    const { data } = await service().from("tournaments").select("id").eq("id", tId);
    expect(data ?? []).toHaveLength(0);
  });
});
