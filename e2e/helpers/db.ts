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
  opts: { completeOnboarding?: boolean; becomeAdmin?: boolean } = {},
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
        first_name: "Test",
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
  opts: { completeOnboarding?: boolean } = {},
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

/** Best-effort teardown — removes the auth user (cascades the profile). */
export async function deleteUser(id: string): Promise<void> {
  await service().auth.admin.deleteUser(id).catch(() => undefined);
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
