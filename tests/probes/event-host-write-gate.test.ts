/**
 * Event-host write gate.
 *
 * `p_tournaments_write` / `p_events_write` used to ask only "is this row
 * yours?" (`owner_id = auth.uid() or is_admin()`). An attendee satisfies
 * that by writing their own id into the payload, and `owner_id`,
 * `claimed`, and `lifecycle` are all grantable to `authenticated` — so
 * an attendee could POST straight to PostgREST and publish a tournament
 * + an `active` event that anon then reads out of public discovery.
 * The `user_type === 'attendee'` check in the createTournament action
 * was the only thing in the way, and per the RLS-is-the-boundary
 * convention that is an affordance, not a gate (same shape as C-1).
 *
 * Migration 20260719000001 adds `is_event_host()` to both policies.
 * These tests drive the DB directly — no server action in the path — so
 * they fail if the predicate is ever dropped back to an ownership-only
 * check.
 */
import { afterAll, describe, expect, it } from "vitest";
import { anon, createUser, purge, service } from "../harness";

const users: string[] = [];
const tournaments: string[] = [];

afterAll(async () => {
  const svc = service();
  for (const id of tournaments) {
    await svc.from("events").delete().eq("tournament_id", id);
    await svc.from("tournaments").delete().eq("id", id);
  }
  await purge(users);
});

async function attendee() {
  const u = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  users.push(u.id);
  return u;
}

async function director() {
  const u = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  users.push(u.id);
  return u;
}

describe("event-host write gate · attendees cannot host events", () => {
  it("attendee cannot INSERT a tournament even owned by themselves", async () => {
    const att = await attendee();
    const { data, error } = await att.client
      .from("tournaments")
      .insert({
        title: "Attendee Fake Cup",
        owner_id: att.id,
        created_by: att.id,
        claimed: true,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    expect(error).not.toBeNull();
    expect(data).toBeNull();

    // Nothing landed — the row must not exist under any visibility.
    const { data: rows } = await service()
      .from("tournaments")
      .select("id")
      .eq("created_by", att.id);
    expect(rows ?? []).toHaveLength(0);
  });

  it("attendee cannot INSERT an event under an ED's tournament", async () => {
    const ed = await director();
    const att = await attendee();

    const { data: t } = await service()
      .from("tournaments")
      .insert({
        title: "Host Cup",
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
      })
      .select("id")
      .single<{ id: string }>();
    tournaments.push(t!.id);

    const { error } = await att.client.from("events").insert({
      tournament_id: t!.id,
      owner_id: att.id,
      created_by: att.id,
      claimed: true,
      title: "Attendee Fake Event",
      lifecycle: "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    });

    expect(error).not.toBeNull();
    const { data: rows } = await service()
      .from("events")
      .select("id")
      .eq("created_by", att.id);
    expect(rows ?? []).toHaveLength(0);
  });

  it("the attendee-published-event route into public discovery is closed", async () => {
    const att = await attendee();
    const { data: t } = await att.client
      .from("tournaments")
      .insert({
        title: "Attendee Discovery Cup",
        owner_id: att.id,
        created_by: att.id,
        claimed: true,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    // The chain dies at step 1; nothing reaches anon's public read.
    expect(t).toBeNull();
    const { data: pub } = await anon()
      .from("events")
      .select("id")
      .eq("title", "Attendee Fake Event");
    expect(pub ?? []).toHaveLength(0);
  });

  it("attendee cannot UPDATE an ED's tournament or event", async () => {
    const ed = await director();
    const att = await attendee();
    const svc = service();

    const { data: t } = await svc
      .from("tournaments")
      .insert({
        title: "Untouchable Cup",
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
      })
      .select("id")
      .single<{ id: string }>();
    tournaments.push(t!.id);
    const { data: e } = await svc
      .from("events")
      .insert({
        tournament_id: t!.id,
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
        title: "Untouchable Event",
        lifecycle: "active",
        start_date: "2030-06-01",
        end_date: "2030-06-03",
      })
      .select("id")
      .single<{ id: string }>();

    // Seizing ownership is the interesting variant: it would satisfy an
    // ownership-only WITH CHECK.
    await att.client
      .from("tournaments")
      .update({ title: "Seized", owner_id: att.id })
      .eq("id", t!.id);
    await att.client
      .from("events")
      .update({ title: "Seized", owner_id: att.id })
      .eq("id", e!.id);

    const { data: tAfter } = await svc
      .from("tournaments")
      .select("title, owner_id")
      .eq("id", t!.id)
      .single<{ title: string; owner_id: string }>();
    const { data: eAfter } = await svc
      .from("events")
      .select("title, owner_id")
      .eq("id", e!.id)
      .single<{ title: string; owner_id: string }>();

    expect(tAfter!.title).toBe("Untouchable Cup");
    expect(tAfter!.owner_id).toBe(ed.id);
    expect(eAfter!.title).toBe("Untouchable Event");
    expect(eAfter!.owner_id).toBe(ed.id);
  });

  it("anon cannot INSERT a tournament", async () => {
    const { error } = await anon()
      .from("tournaments")
      .insert({ title: "Anon Cup", claimed: false });
    expect(error).not.toBeNull();
  });

  it("an ED is still able to create and publish their own event", async () => {
    const ed = await director();
    const { data: t, error: tErr } = await ed.client
      .from("tournaments")
      .insert({
        title: "Legit ED Cup",
        owner_id: ed.id,
        created_by: ed.id,
        claimed: true,
      })
      .select("id")
      .single<{ id: string }>();
    expect(tErr).toBeNull();
    tournaments.push(t!.id);

    const { error: eErr } = await ed.client.from("events").insert({
      tournament_id: t!.id,
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
      title: "Legit ED Event",
      lifecycle: "active",
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    });
    expect(eErr).toBeNull();
  });

  it("an admin can still create an unclaimed tournament they do not own", async () => {
    const admin = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      becomeAdmin: true,
      completeOnboarding: true,
      role: "coach",
    });
    users.push(admin.id);

    const { data, error } = await admin.client
      .from("tournaments")
      .insert({
        title: "Admin Unclaimed Cup",
        owner_id: null,
        created_by: admin.id,
        claimed: false,
      })
      .select("id")
      .single<{ id: string }>();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    tournaments.push(data!.id);
  });
});
