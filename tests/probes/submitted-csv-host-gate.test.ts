/**
 * submitted_csvs write gate (sibling of S10.1 / S10.2).
 *
 * `p_csv_rw` was ownership-only (`ed_id = auth.uid() or is_admin()`) for
 * every verb. `ed_id` is caller-supplied and INSERT is granted to
 * `authenticated`, so an attendee could POST a submitted_csvs row naming
 * themselves and dump arbitrary emails into `raw_emails` — a PII/spam
 * injection into the admin review queue. And the write never checked the
 * CSV's event belonged to the caller (the S10.2 parent-auth class).
 *
 * Migration 20260719000005 splits the policy: writes require
 * is_event_host(), and INSERT requires the caller own the event.
 *
 * Migration 20260719000006 drops the owner arm of UPDATE entirely:
 * `status` is the admin review verdict, so an ED must not be able to
 * flip their own row to 'approved' and skip review. Column grants
 * can't express this (admin and ED are both `authenticated`), so the
 * UPDATE policy is is_admin()-only.
 *
 * Migration 20260719000012 narrows the DELETE owner arm to
 * status = 'pending': once an admin verdict exists (approved /
 * rejected), the row is the review record — an ED deleting it would
 * erase the verdict (and cascade the promo_codes audit anchor), so
 * only admins may.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, purge, service } from "../harness";
import type { SupabaseClient } from "@supabase/supabase-js";

const users: string[] = [];
const tournaments: string[] = [];

let edA: { id: string; client: SupabaseClient };
let edB: { id: string; client: SupabaseClient };
let attendee: { id: string; client: SupabaseClient };
let eventA = "";

async function director() {
  const u = await createUser({
    metadata: { user_type: "event_director", role_title: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  users.push(u.id);
  return u;
}

beforeAll(async () => {
  edA = await director();
  edB = await director();
  attendee = await createUser({
    metadata: { user_type: "attendee", role_title: "coach" },
    completeOnboarding: true,
    role: "coach",
  });
  users.push(attendee.id);

  const svc = service();
  const { data: t } = await svc
    .from("tournaments")
    .insert({ title: "CSV Cup", owner_id: edA.id, created_by: edA.id, claimed: true })
    .select("id")
    .single<{ id: string }>();
  tournaments.push(t!.id);
  const { data: e } = await svc
    .from("events")
    .insert({
      tournament_id: t!.id,
      owner_id: edA.id,
      created_by: edA.id,
      claimed: true,
      title: "CSV Event",
      lifecycle: "active",
      is_premium: true,
      start_date: "2030-06-01",
      end_date: "2030-06-03",
    })
    .select("id")
    .single<{ id: string }>();
  eventA = e!.id;
});

afterAll(async () => {
  const svc = service();
  for (const t of tournaments) {
    await svc.from("submitted_csvs").delete().eq("event_id", eventA);
    await svc.from("events").delete().eq("tournament_id", t);
    await svc.from("tournaments").delete().eq("id", t);
  }
  await purge(users);
});

function payload(edId: string) {
  return {
    ed_id: edId,
    event_id: eventA,
    file_path: `probe://${edId}`,
    raw_emails: ["victim@example.com"],
    status: "pending",
  };
}

describe("submitted_csvs write gate", () => {
  it("an attendee CANNOT insert a submitted_csvs row (no email injection)", async () => {
    const { data, error } = await attendee.client
      .from("submitted_csvs")
      .insert(payload(attendee.id))
      .select("id")
      .maybeSingle<{ id: string }>();
    expect(error).not.toBeNull();
    expect(data).toBeNull();

    const { data: rows } = await service()
      .from("submitted_csvs")
      .select("id")
      .eq("ed_id", attendee.id);
    expect(rows ?? []).toHaveLength(0);
  });

  it("an ED CANNOT insert a CSV for another ED's event", async () => {
    const { error } = await edB.client
      .from("submitted_csvs")
      .insert(payload(edB.id));
    expect(error).not.toBeNull();

    const { data: rows } = await service()
      .from("submitted_csvs")
      .select("id")
      .eq("ed_id", edB.id);
    expect(rows ?? []).toHaveLength(0);
  });

  it("the owning ED CAN insert a CSV for their own event", async () => {
    const { data, error } = await edA.client
      .from("submitted_csvs")
      .insert(payload(edA.id))
      .select("id")
      .single<{ id: string }>();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    await service().from("submitted_csvs").delete().eq("id", data!.id);
  });

  it("an attendee still can't insert even claiming another ED's id", async () => {
    const { error } = await attendee.client
      .from("submitted_csvs")
      .insert({ ...payload(edA.id) }); // ed_id spoofed to a real ED
    expect(error).not.toBeNull();
  });
});

describe("submitted_csvs status transitions are admin-only", () => {
  let csvId = "";

  beforeAll(async () => {
    const { data, error } = await service()
      .from("submitted_csvs")
      .insert(payload(edA.id))
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(error.message);
    csvId = data!.id;
  });

  afterAll(async () => {
    await service().from("submitted_csvs").delete().eq("id", csvId);
  });

  it("the owning ED CANNOT flip their own submission to 'approved'", async () => {
    const { data } = await edA.client
      .from("submitted_csvs")
      .update({ status: "approved" })
      .eq("id", csvId)
      .select("id");
    // RLS filters the row out of the UPDATE: zero rows touched, no error.
    expect(data ?? []).toHaveLength(0);

    const { data: after } = await service()
      .from("submitted_csvs")
      .select("status")
      .eq("id", csvId)
      .single<{ status: string }>();
    expect(after?.status).toBe("pending");
  });

  it("an admin CAN reject (status + reason)", async () => {
    const admin = await createUser({ becomeAdmin: true, completeOnboarding: true });
    users.push(admin.id);
    const { data, error } = await admin.client
      .from("submitted_csvs")
      .update({ status: "rejected", rejection_reason: "probe" })
      .eq("id", csvId)
      .select("id, status");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const { data: after } = await service()
      .from("submitted_csvs")
      .select("status")
      .eq("id", csvId)
      .single<{ status: string }>();
    expect(after?.status).toBe("rejected");
  });
});

describe("submitted_csvs ED delete is pending-only (S10.16)", () => {
  async function seedCsv(status: string): Promise<string> {
    const { data, error } = await service()
      .from("submitted_csvs")
      .insert({ ...payload(edA.id), status })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(error.message);
    return data!.id;
  }

  async function stillExists(id: string): Promise<boolean> {
    const { data } = await service()
      .from("submitted_csvs")
      .select("id")
      .eq("id", id);
    return (data ?? []).length === 1;
  }

  it("the owning ED CANNOT delete an approved or rejected submission", async () => {
    for (const status of ["approved", "rejected"]) {
      const id = await seedCsv(status);
      const { data } = await edA.client
        .from("submitted_csvs")
        .delete()
        .eq("id", id)
        .select("id");
      // RLS filters the row out of the DELETE: zero rows, no error.
      expect(data ?? []).toHaveLength(0);
      expect(await stillExists(id)).toBe(true);
      await service().from("submitted_csvs").delete().eq("id", id);
    }
  });

  it("the owning ED CAN still cancel a pending submission", async () => {
    const id = await seedCsv("pending");
    const { data, error } = await edA.client
      .from("submitted_csvs")
      .delete()
      .eq("id", id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(await stillExists(id)).toBe(false);
  });

  it("an admin CAN still delete a reviewed submission", async () => {
    const admin = await createUser({ becomeAdmin: true, completeOnboarding: true });
    users.push(admin.id);
    const id = await seedCsv("approved");
    const { data, error } = await admin.client
      .from("submitted_csvs")
      .delete()
      .eq("id", id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(await stillExists(id)).toBe(false);
  });
});
