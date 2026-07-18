/**
 * Event edit/publish grant probe.
 *
 * `saveEvent` used to write the base row with a single `upsert`.
 * PostgREST compiles that to `INSERT … ON CONFLICT (id) DO UPDATE SET
 * <every payload key> = excluded.<key>` — `id` included. `id` is
 * deliberately absent from the events UPDATE column grant (repointing a
 * row's id is not an edit), so Postgres denied the statement outright:
 * "permission denied for table events". Creating an event worked (no
 * `id` in the payload, so none in the SET list), which is why the gap
 * hid — every EDIT and every publish-a-draft was denied.
 *
 * The action now branches: INSERT for new, UPDATE…eq(id) for existing.
 * These tests run through the real action as a real ED, so they fail if
 * the upsert ever comes back or the grant is widened to cover `id`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

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

import { saveEvent } from "@/app/dashboard/events/event-actions";

let edId = "";
let eventId = "";
let tournamentId = "";

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

describe("event edit grants · an ED can actually save an existing event", () => {
  it("an update-intent save succeeds and persists the new title", async () => {
    const fd = new FormData();
    fd.set("intent", "update");
    fd.set("event_id", eventId);
    fd.set("title", "Edited By Owner");

    const result = await saveEvent({}, fd);
    expect(result.error).toBeUndefined();
    expect(result.fieldErrors).toBeUndefined();
    expect(result.createdId).toBe(eventId);

    const { data } = await service()
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single<{ title: string }>();
    expect(data!.title).toBe("Edited By Owner");
  });

  it("publishing an existing draft succeeds and flips lifecycle to active", async () => {
    const svc = service();
    await svc.from("events").update({ lifecycle: "draft" }).eq("id", eventId);

    const fd = new FormData();
    fd.set("intent", "publish");
    fd.set("event_id", eventId);
    fd.set("title", "Published By Owner");
    fd.set("logo_url", "https://example.test/logo.png");
    fd.set("website_url", "https://example.test");
    fd.set("host_club", "Probe Club");
    fd.set("start_date", "2030-06-01");
    fd.set("end_date", "2030-06-03");
    fd.set("description", "A probe event.");
    fd.set("location_formatted", "Kansas City, MO");
    fd.set("region", "II");
    fd.set("competition_levels", JSON.stringify(["middle"]));
    fd.set("surfaces", JSON.stringify(["grass"]));
    const { data: season } = await svc
      .from("seasons")
      .select("id")
      .limit(1)
      .single<{ id: string }>();
    fd.set("season_id", season!.id);

    const result = await saveEvent({}, fd);
    expect(result.error).toBeUndefined();
    expect(result.fieldErrors).toBeUndefined();

    const { data } = await svc
      .from("events")
      .select("lifecycle, title")
      .eq("id", eventId)
      .single<{ lifecycle: string; title: string }>();
    expect(data!.lifecycle).toBe("active");
    expect(data!.title).toBe("Published By Owner");
  });

  it("the edit path cannot repoint the row's id (no UPDATE grant on id)", async () => {
    const { error } = await ctl
      .client!.from("events")
      .update({ id: crypto.randomUUID() })
      .eq("id", eventId);
    expect(error).not.toBeNull();
  });
});
