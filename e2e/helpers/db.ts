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

/**
 * Create a confirmed attendee (role = coach) and return usable credentials.
 * The handle_new_user trigger materializes the profile from the metadata;
 * `completeOnboarding` then fills the mandatory fields so login routes past
 * onboarding straight to the events page.
 */
export async function createAttendee(
  opts: { completeOnboarding?: boolean } = {},
): Promise<SeededUser> {
  const svc = service();
  const email = `e2e-${randomUUID()}@local.test`;
  const password = "TgTest123";

  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { user_type: "attendee", role_title: "coach" },
  });
  if (error || !data.user) {
    throw new Error(`createAttendee: ${error?.message ?? "no user returned"}`);
  }
  const id = data.user.id;

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
        role_title: "coach",
        onboarding_completed: true,
        preferences_completed: true,
      })
      .eq("id", id);
    if (upErr) throw new Error(`completeOnboarding: ${upErr.message}`);
  }

  return { id, email, password };
}

/** Best-effort teardown — removes the auth user (cascades the profile). */
export async function deleteUser(id: string): Promise<void> {
  await service().auth.admin.deleteUser(id).catch(() => undefined);
}
