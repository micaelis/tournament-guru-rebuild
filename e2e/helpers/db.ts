import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env";

/**
 * Service-role client (bypasses RLS + can create users) for seeding E2E
 * fixtures. Mirrors tests/harness.ts but stands alone so the Playwright suite
 * doesn't depend on the Vitest harness.
 */
function service(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SeededUser = { id: string; email: string; password: string };
type UserType = "attendee" | "event_director";

/**
 * Create a confirmed user of `userType` with `role`. The handle_new_user
 * trigger materializes the profile from the metadata; `completeOnboarding`
 * then fills the mandatory fields so login routes past onboarding.
 */
async function createUser(
  userType: UserType,
  role: string,
  opts: {
    completeOnboarding?: boolean;
    becomeAdmin?: boolean;
    firstName?: string;
  } = {},
): Promise<SeededUser> {
  const svc = service();
  const email = `e2e-${randomUUID()}@local.test`;
  const password = "TgTest123";

  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { user_type: userType, role_title: role },
  });
  if (error || !data.user) {
    throw new Error(`createUser: ${error?.message ?? "no user returned"}`);
  }
  const id = data.user.id;

  // Elevate BEFORE completing onboarding — a trigger locks user_type/role once
  // onboarding_completed flips, and that lock applies to the service role too.
  if (opts.becomeAdmin) {
    const { error: adminErr } = await svc
      .from("profiles")
      .update({ user_type: "admin" })
      .eq("id", id);
    if (adminErr) throw new Error(`becomeAdmin: ${adminErr.message}`);
  }

  if (opts.completeOnboarding) {
    const { error: upErr } = await svc
      .from("profiles")
      .update({
        first_name: opts.firstName ?? "Test",
        last_name: "User",
        dob: "1990-01-01",
        user_gender: "male",
        location_formatted: "Test City, MO",
        organization_title: "Test Org",
        role_title: role,
        onboarding_completed: true,
        preferences_completed: true,
        ...(userType === "event_director"
          ? { org_description: "We run great youth tournaments." }
          : {}),
      })
      .eq("id", id);
    if (upErr) throw new Error(`completeOnboarding: ${upErr.message}`);
  }

  return { id, email, password };
}

/** Attendee (role = coach). */
export function createAttendee(
  opts: { completeOnboarding?: boolean; firstName?: string } = {},
): Promise<SeededUser> {
  return createUser("attendee", "coach", opts);
}

/** Event Director (role = event_director). */
export function createEventDirector(
  opts: { completeOnboarding?: boolean } = {},
): Promise<SeededUser> {
  return createUser("event_director", "event_director", opts);
}

/**
 * Admin — onboarded, then elevated to user_type=admin via the service role
 * (the handle_new_user trigger deliberately refuses admin from metadata, so
 * this must be a post-hoc update; see the C1 probe).
 */
export async function createAdmin(): Promise<SeededUser> {
  return createUser("attendee", "coach", {
    becomeAdmin: true,
    completeOnboarding: true,
  });
}

/** Set arbitrary profile columns (service role) for fixture setup. */
export async function setProfileFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await service().from("profiles").update(fields).eq("id", id);
  if (error) throw new Error(`setProfileFields: ${error.message}`);
}

/** Read back specific profile columns (service role) for assertions. */
export async function getProfileFields(
  id: string,
  columns: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await service()
    .from("profiles")
    .select(columns)
    .eq("id", id)
    .single();
  if (error) throw new Error(`getProfileFields: ${error.message}`);
  return data as unknown as Record<string, unknown>;
}

/** Read a user's saved onboarding teams (service role) for assertions. */
export async function getUserTeams(
  profileId: string,
): Promise<{ slot: number; team_gender: string | null; age: string | null }[]> {
  const { data, error } = await service()
    .from("user_teams")
    .select("slot, team_gender, age")
    .eq("profile_id", profileId)
    .order("slot");
  if (error) throw new Error(`getUserTeams: ${error.message}`);
  return data ?? [];
}

/** Best-effort teardown — removes the auth user (cascades the profile). */
export async function deleteUser(id: string): Promise<void> {
  await service().auth.admin.deleteUser(id).catch(() => undefined);
}

/** Teardown for a user created through the UI (no id handed back). */
export async function deleteUserByEmail(email: string): Promise<void> {
  const svc = service();
  const { data } = await svc.auth.admin
    .listUsers({ page: 1, perPage: 1000 })
    .catch(() => ({ data: { users: [] } }));
  const user = data?.users?.find((u) => u.email === email);
  if (user) await deleteUser(user.id);
}

/** A tournament owned by `ownerId` (so an ED can reach the Add Event form). */
export async function seedTournament(
  ownerId: string,
  opts: { title?: string } = {},
): Promise<string> {
  const { data, error } = await service()
    .from("tournaments")
    .insert({
      title: opts.title ?? `E2E Cup ${randomUUID().slice(0, 6)}`,
      owner_id: ownerId,
      created_by: ownerId,
      claimed: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedTournament: ${error?.message}`);
  return data.id as string;
}

export async function deleteTournament(id: string): Promise<void> {
  await service().from("tournaments").delete().eq("id", id);
}

/** Clean up a tournament created through the UI (no id handed back). */
export async function deleteTournamentByTitle(title: string): Promise<void> {
  await service().from("tournaments").delete().eq("title", title);
}

/** A recently-concluded event owned by `ownerId` (+ its tournament). */
export async function seedEvent(
  ownerId: string,
  opts: { premium?: boolean; lifecycle?: "draft" | "active"; title?: string } = {},
): Promise<{ tournamentId: string; eventId: string }> {
  const svc = service();
  const { data: t, error: tErr } = await svc
    .from("tournaments")
    .insert({
      title: `E2E Cup ${randomUUID().slice(0, 6)}`,
      owner_id: ownerId,
      created_by: ownerId,
      claimed: true,
    })
    .select("id")
    .single();
  if (tErr || !t) throw new Error(`seedEvent tournament: ${tErr?.message}`);
  const { data: e, error: eErr } = await svc
    .from("events")
    .insert({
      tournament_id: t.id,
      owner_id: ownerId,
      created_by: ownerId,
      claimed: true,
      title: opts.title ?? `E2E Event ${randomUUID().slice(0, 6)}`,
      lifecycle: opts.lifecycle ?? "active",
      is_premium: opts.premium ?? false,
      start_date: daysAgo(3),
      end_date: daysAgo(1),
    })
    .select("id")
    .single();
  if (eErr || !e) throw new Error(`seedEvent event: ${eErr?.message}`);
  return { tournamentId: t.id as string, eventId: e.id as string };
}

/**
 * A fully-populated, publish-quality event owned by `ownerId` — every
 * field the EventForm marks `required` is filled, plus one competition
 * level + one surface child row. The edit form loads this valid, so an
 * edit journey can change one field and submit without tripping the
 * browser's required-field validation on the untouched inputs.
 */
export async function seedCompleteEvent(
  ownerId: string,
  opts: { lifecycle?: "draft" | "active"; title?: string } = {},
): Promise<{ tournamentId: string; eventId: string }> {
  const svc = service();
  const { data: t, error: tErr } = await svc
    .from("tournaments")
    .insert({
      title: `E2E Cup ${randomUUID().slice(0, 6)}`,
      owner_id: ownerId,
      created_by: ownerId,
      claimed: true,
    })
    .select("id")
    .single();
  if (tErr || !t) throw new Error(`seedCompleteEvent tournament: ${tErr?.message}`);

  const { data: season } = await svc
    .from("seasons")
    .select("id")
    .limit(1)
    .single();

  const { data: e, error: eErr } = await svc
    .from("events")
    .insert({
      tournament_id: t.id,
      owner_id: ownerId,
      created_by: ownerId,
      claimed: true,
      title: opts.title ?? `E2E Complete Event ${randomUUID().slice(0, 6)}`,
      lifecycle: opts.lifecycle ?? "active",
      logo_url: "https://example.com/logo.png",
      website_url: "https://example.com",
      host_club: "Gateway SC",
      description: "A premier youth tournament with strong competition.",
      location_formatted: "St. Louis, MO",
      region: "I",
      season_id: (season as { id: string } | null)?.id ?? null,
      start_date: daysAgo(3),
      end_date: daysAgo(1),
    })
    .select("id")
    .single();
  if (eErr || !e) throw new Error(`seedCompleteEvent event: ${eErr?.message}`);

  await svc
    .from("event_competition_levels")
    .insert({ event_id: e.id, level: "upper" });
  await svc.from("event_surfaces").insert({ event_id: e.id, surface: "grass" });

  return { tournamentId: t.id as string, eventId: e.id as string };
}

/** Read back event columns (service role) for post-journey assertions. */
export async function getEventFields(
  id: string,
  columns: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await service()
    .from("events")
    .select(columns)
    .eq("id", id)
    .single();
  if (error) throw new Error(`getEventFields: ${error.message}`);
  return data as unknown as Record<string, unknown>;
}

/** Does a tournament row still exist? (delete-journey assertion) */
export async function tournamentExists(id: string): Promise<boolean> {
  const { data } = await service().from("tournaments").select("id").eq("id", id);
  return (data ?? []).length === 1;
}

/** A tournament created by an admin and left unclaimed (owner_id null). */
export async function seedUnclaimedTournament(
  adminId: string,
  opts: { title?: string } = {},
): Promise<string> {
  const { data, error } = await service()
    .from("tournaments")
    .insert({
      title: opts.title ?? `E2E Unclaimed ${randomUUID().slice(0, 6)}`,
      owner_id: null,
      created_by: adminId,
      claimed: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedUnclaimedTournament: ${error?.message}`);
  return data.id as string;
}

export async function deleteEvent(id: string): Promise<void> {
  await service().from("events").delete().eq("id", id);
}

/** Remove any submitted CSVs (+ their promo codes) for an event. */
export async function deleteSubmittedCsvsForEvent(
  eventId: string,
): Promise<void> {
  const svc = service();
  await svc.from("promo_codes").delete().eq("event_id", eventId);
  await svc.from("submitted_csvs").delete().eq("event_id", eventId);
}

/** A published coach review on `eventId` by `authorId`. Returns the id. */
export async function seedReview(
  eventId: string,
  authorId: string,
  title: string,
): Promise<string> {
  const { data, error } = await service()
    .from("reviews")
    .insert({
      event_id: eventId,
      author_id: authorId,
      status: "published",
      review_title: title,
      review_body: "Solid event overall — well organized, strong competition.",
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
    .single();
  if (error || !data) throw new Error(`seedReview: ${error?.message}`);
  return data.id as string;
}

export async function deleteReview(id: string): Promise<void> {
  await service().from("reviews").delete().eq("id", id);
}

/** Remove a banned word (E2E cleanup for the admin banned-words test). */
export async function deleteBannedWord(word: string): Promise<void> {
  await service().from("banned_words").delete().eq("word", word);
}

export type PromoSeed = {
  token: string;
  email: string;
  eventId: string;
  tournamentId: string;
  edId: string;
  csvId: string;
};

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/**
 * Seed a full verified-review promo addressed to `email`: an ED owner, a
 * tournament + a recently-concluded event, an approved CSV, and a 'sent'
 * promo_code. Mirrors the C4 probe fixture. Tear down with deletePromo.
 */
export async function seedPromo(email: string): Promise<PromoSeed> {
  const svc = service();
  const ed = await createEventDirector({ completeOnboarding: true });

  const { data: t, error: tErr } = await svc
    .from("tournaments")
    .insert({
      title: `E2E Cup ${randomUUID().slice(0, 6)}`,
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
    })
    .select("id")
    .single();
  if (tErr || !t) throw new Error(`seedPromo tournament: ${tErr?.message}`);

  const { data: e, error: eErr } = await svc
    .from("events")
    .insert({
      tournament_id: t.id,
      owner_id: ed.id,
      created_by: ed.id,
      claimed: true,
      title: `E2E Event ${randomUUID().slice(0, 6)}`,
      lifecycle: "active",
      is_premium: true,
      start_date: daysAgo(3),
      end_date: daysAgo(1),
    })
    .select("id")
    .single();
  if (eErr || !e) throw new Error(`seedPromo event: ${eErr?.message}`);

  const token = `T-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const { data: csv, error: csvErr } = await svc
    .from("submitted_csvs")
    .insert({
      ed_id: ed.id,
      event_id: e.id,
      file_path: "e2e://",
      raw_emails: [email],
      status: "approved",
    })
    .select("id")
    .single();
  if (csvErr || !csv) throw new Error(`seedPromo csv: ${csvErr?.message}`);

  const { error: pErr } = await svc.from("promo_codes").insert({
    submitted_csv_id: csv.id,
    event_id: e.id,
    email,
    pretty_code: "E2E12345",
    url_token: token,
    status: "sent",
  });
  if (pErr) throw new Error(`seedPromo promo_code: ${pErr.message}`);

  return {
    token,
    email,
    eventId: e.id as string,
    tournamentId: t.id as string,
    edId: ed.id,
    csvId: csv.id as string,
  };
}

/** Tear down a promo fixture (FK-safe order), then the ED owner. */
export async function deletePromo(s: PromoSeed): Promise<void> {
  const svc = service();
  await svc.from("promo_codes").delete().eq("url_token", s.token);
  await svc.from("submitted_csvs").delete().eq("id", s.csvId);
  await svc.from("events").delete().eq("id", s.eventId);
  await svc.from("tournaments").delete().eq("id", s.tournamentId);
  await deleteUser(s.edId);
}

/**
 * A published (non-draft) seeded event to drive the event-detail page.
 * Skips the transient "Probe"/"Second" rows earlier test runs may have left
 * so the title assertion lands on real demo data.
 */
export async function firstViewableEvent(): Promise<{
  id: string;
  title: string;
}> {
  const { data, error } = await service()
    .from("events")
    .select("id, title")
    .neq("lifecycle", "draft")
    .not("title", "ilike", "%Probe%")
    .not("title", "ilike", "%Second%")
    .order("title", { ascending: true })
    .limit(1);
  if (error) throw new Error(`firstViewableEvent: ${error.message}`);
  const row = data?.[0];
  if (!row) throw new Error("firstViewableEvent: no seeded events found");
  return { id: row.id as string, title: row.title as string };
}
