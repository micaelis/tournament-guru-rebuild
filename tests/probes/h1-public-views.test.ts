/**
 * H1 probes — public reviewer / comment / host identity comes through
 * the SECURITY DEFINER views. Anon callers see first_name + org +
 * photo, never last_name / email / dob. Direct reads of the profiles
 * table for these fields return nothing (RLS-protected).
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  anon,
  createUser,
  purge,
  seedTournamentAndEvent,
  service,
} from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

describe("H1 · public identity views", () => {
  it("anon SELECT on review_author_public returns first_name + org for a published review", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);
    const coach = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
      firstName: "Publicly",
      lastName: "Named",
      organization: "Neighborhood FC",
    });
    users.push(coach.id);
    const { eventId } = await seedTournamentAndEvent(ed.client);
    const { data: review } = await coach.client
      .from("reviews")
      .insert({
        event_id: eventId,
        author_id: coach.id,
        status: "published",
        rating_fields: 5,
        rating_facilities: 5,
        rating_management: 5,
        rating_competition: 5,
        rating_diversity: 5,
        rating_cost_value: 5,
        review_title: "Fine",
        review_body: "Fine",
        reviewer_user_type: "attendee",
        reviewer_role: "coach",
      })
      .select("id")
      .single();

    const anonClient = anon();
    const { data, error } = await anonClient
      .from("review_author_public")
      .select(
        "first_name, last_initial, organization_title, profile_photo_url, reviewer_role",
      )
      .eq("review_id", review!.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.first_name).toBe("Publicly");
    // The public name rule: first name + last INITIAL, never the last name.
    expect(data!.last_initial).toBe("N");
    expect(data!.organization_title).toBe("Neighborhood FC");
    expect(data!.reviewer_role).toBe("coach");

    const { error: lastErr } = await anonClient
      .from("review_author_public")
      .select("last_name")
      .eq("review_id", review!.id)
      .maybeSingle();
    expect(lastErr).not.toBeNull();
  });

  it("public_attendees serves first_name + last_initial but never last_name; EDs and blocked users drop out", async () => {
    const attendee = await createUser({
      metadata: { user_type: "attendee", role_title: "coach" },
      completeOnboarding: true,
      role: "coach",
      firstName: "Ashley",
      lastName: "Marks",
      organization: "Riverside FC",
    });
    users.push(attendee.id);
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);

    const anonClient = anon();
    const { data, error } = await anonClient
      .from("public_attendees")
      .select("id, first_name, last_initial, role_title, organization_title")
      .eq("id", attendee.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.first_name).toBe("Ashley");
    expect(data!.last_initial).toBe("M");
    expect(data!.role_title).toBe("coach");
    expect(data!.organization_title).toBe("Riverside FC");

    // last_name is not in the projection.
    const { error: lastErr } = await anonClient
      .from("public_attendees")
      .select("last_name")
      .eq("id", attendee.id)
      .maybeSingle();
    expect(lastErr).not.toBeNull();

    // EDs are not attendees — they live on public_directors instead.
    const { data: edRow } = await anonClient
      .from("public_attendees")
      .select("id")
      .eq("id", ed.id)
      .maybeSingle();
    expect(edRow).toBeNull();

    // Blocking removes the public page.
    await service().from("profiles").update({ blocked: true }).eq("id", attendee.id);
    const { data: blockedRow } = await anonClient
      .from("public_attendees")
      .select("id")
      .eq("id", attendee.id)
      .maybeSingle();
    expect(blockedRow).toBeNull();
  });

  it("anon SELECT on profiles for the same reviewer returns nothing", async () => {
    // Direct read of profiles is RLS-gated → anon gets no rows.
    const anonClient = anon();
    const { data } = await anonClient
      .from("profiles")
      .select("id, last_name")
      .limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("anon SELECT on public_event_owners returns the ED's public fields but not last_name", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
      firstName: "Public",
      lastName: "SecretName",
      organization: "The Org",
    });
    users.push(ed.id);
    const anonClient = anon();
    const { data, error } = await anonClient
      .from("public_event_owners")
      .select("id, first_name, organization_title, org_description")
      .eq("id", ed.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.first_name).toBe("Public");
    // Selecting last_name from the view should fail because it's not
    // in the projection.
    const { error: lastErr } = await anonClient
      .from("public_event_owners")
      .select("last_name")
      .eq("id", ed.id)
      .maybeSingle();
    expect(lastErr).not.toBeNull();
  });
});

/**
 * H1 write-denial — the public projection views must be READ-ONLY.
 *
 * They carry no RLS and run as their owner (`security_invoker = false`,
 * owner `postgres` has BYPASSRLS), so a table-level write grant on one
 * is a straight RLS bypass into the base table. 20260718000005's
 * `grant all on all tables` handed exactly that to anon and
 * authenticated until 20260718000008 revoked it.
 *
 * Add any new `public.*` view to PUBLIC_VIEWS below — 000005's
 * `alter default privileges ... on tables` still grants write to views
 * created after it, so a new view starts out writable.
 *
 * `key` must be a real column on the view and `first_name` must be in
 * its projection — otherwise PostgREST rejects with 42703 (undefined
 * column) before it ever evaluates privileges, and the assertion would
 * pass for the wrong reason.
 */
const PUBLIC_VIEWS = [
  { view: "public_directors", key: "id" },
  { view: "public_event_owners", key: "id" },
  { view: "public_comment_authors", key: "author_id" },
  { view: "review_author_public", key: "review_id" },
  { view: "public_attendees", key: "id" },
] as const;

const ANY_UUID = "aaaaaaaa-0000-0000-0000-000000000002";

/**
 * A write must be refused for a *real* reason:
 *   42501 — permission denied (the write grant is revoked)
 *   55000 — view is not auto-updatable (multi-table join)
 * 42703 (undefined column) would mean the probe never reached the
 * privilege check, so it is asserted against explicitly.
 */
function expectDenied(
  error: { code: string; message: string } | null,
  view: string,
  verb: string,
) {
  expect(error, `${view} accepted an ${verb}`).not.toBeNull();
  expect(
    error!.code,
    `${view}: ${verb} rejected on a bad column, not on privileges — ` +
      `this assertion proves nothing (${error!.message})`,
  ).not.toBe("42703");
  expect(
    ["42501", "55000"],
    `${view}: unexpected ${verb} failure ${error!.code} — ${error!.message}`,
  ).toContain(error!.code);
}

describe("H1 · public views are read-only", () => {
  it.each(PUBLIC_VIEWS)("anon cannot UPDATE $view", async ({ view, key }) => {
    const { error } = await anon()
      .from(view)
      .update({ first_name: "ANON-WRITE-PROBE" })
      .eq(key, ANY_UUID);
    expectDenied(error, view, "anon UPDATE");
  });

  it.each(PUBLIC_VIEWS)("anon cannot DELETE from $view", async ({ view, key }) => {
    const { error } = await anon().from(view).delete().eq(key, ANY_UUID);
    expectDenied(error, view, "anon DELETE");
  });

  it.each(PUBLIC_VIEWS)("anon cannot INSERT into $view", async ({ view }) => {
    const { error } = await anon()
      .from(view)
      .insert({ first_name: "ANON-WRITE-PROBE" });
    expectDenied(error, view, "anon INSERT");
  });

  it.each(PUBLIC_VIEWS)(
    "an authenticated non-owner cannot UPDATE $view",
    async ({ view, key }) => {
      const attacker = await createUser({
        metadata: { user_type: "attendee", role_title: "coach" },
        completeOnboarding: true,
        role: "coach",
      });
      users.push(attacker.id);
      const { error } = await attacker.client
        .from(view)
        .update({ first_name: "AUTHED-WRITE-PROBE" })
        .eq(key, ANY_UUID);
      expectDenied(error, view, "authenticated UPDATE");
    },
  );

  it("anon can still SELECT through the views (read path intact)", async () => {
    const { error } = await anon()
      .from("public_directors")
      .select("id, first_name")
      .limit(1);
    expect(error).toBeNull();
  });

  it("no probe write reached the profiles base table", async () => {
    const { data } = await service()
      .from("profiles")
      .select("id")
      .in("first_name", ["ANON-WRITE-PROBE", "AUTHED-WRITE-PROBE"]);
    expect(data ?? []).toEqual([]);
  });
});
