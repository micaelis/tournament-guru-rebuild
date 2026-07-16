/**
 * Test harness for the Review Gate 1 probes + regression suite.
 *
 * Wires two clients pointed at the local Supabase stack:
 *   - `anon()`   : the public anon key + a fresh session per caller
 *   - `service()`: the service_role key (bypasses RLS) for seeding
 *
 * Every test that mutates data gets a fresh signed-in identity via
 * `createUser()`; the harness uses the same admin API auth clients
 * use in production. Cleanup wipes profiles + auth.users so tests
 * stay hermetic without a full `supabase db reset` per suite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// `||` (not `??`) so an empty env var — as happens when the CI's
// supabase status JSON parse fails — falls back to the local
// supabase-demo defaults instead of shipping an empty string into
// supabase-js and quietly resolving to the anon role.
const API_URL =
  process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/** Fresh anon client with its own session isolation. */
export function anon(): SupabaseClient {
  return createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client (bypasses RLS + can create users). Use ONLY
 * from test harness setup + admin fixtures. */
export function service(): SupabaseClient {
  return createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Create a fresh signed-in user via the admin API + return a client
 * authed as that user. `metadata` flows through `raw_user_meta_data`,
 * which is exactly the path C1 exploits — so C1 tests can pass
 * `user_type: 'admin'` here to exercise the fix.
 *
 * The user is auto-confirmed so signInWithPassword works immediately.
 */
export async function createUser(opts: {
  email?: string;
  password?: string;
  metadata?: Record<string, unknown>;
  becomeAdmin?: boolean;
  completeOnboarding?: boolean;
  role?: string;
  organization?: string;
  firstName?: string;
  lastName?: string;
}): Promise<{
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}> {
  const svc = service();
  const email = opts.email ?? `probe-${randomUUID()}@local.test`;
  const password = opts.password ?? "TgTest123";
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: opts.metadata ?? {},
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = created.user!.id;

  // Fill in the mandatory profile fields when the caller asks for a
  // "fully onboarded" user — most tests hit RLS-gated writes that
  // require role/first_name/etc.
  if (opts.becomeAdmin) {
    await svc
      .from("profiles")
      .update({ user_type: "admin" })
      .eq("id", id);
  }
  if (opts.completeOnboarding) {
    await svc
      .from("profiles")
      .update({
        first_name: opts.firstName ?? "Test",
        last_name: opts.lastName ?? "User",
        dob: "1990-01-01",
        user_gender: "male",
        location_formatted: "Test City, MO",
        organization_title: opts.organization ?? "Test Org",
        onboarding_completed: true,
        preferences_completed: true,
        role_title: opts.role,
      })
      .eq("id", id);
  }

  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id, email, password, client };
}

/**
 * Cleanup helper — wipes profiles + auth.users for the ids we
 * created. Used in `afterEach` / `afterAll` blocks so tests don't
 * accumulate cruft in the local DB.
 */
export async function purge(userIds: string[]): Promise<void> {
  const svc = service();
  for (const id of userIds) {
    await svc.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

/** Small fixture: create a tournament + event owned by the caller. */
export async function seedTournamentAndEvent(
  authedClient: SupabaseClient,
  opts: { premium?: boolean; startDaysFromNow?: number } = {},
): Promise<{ tournamentId: string; eventId: string }> {
  const svc = service();
  const {
    data: { user },
  } = await authedClient.auth.getUser();
  if (!user) throw new Error("seedTournamentAndEvent needs a signed-in client");
  const { data: t, error: tErr } = await svc
    .from("tournaments")
    .insert({
      title: `Probe Cup ${randomUUID().slice(0, 6)}`,
      owner_id: user.id,
      created_by: user.id,
      claimed: true,
    })
    .select("id")
    .single();
  if (tErr) throw new Error(`tournament: ${tErr.message}`);
  const startDate = new Date(
    Date.now() + (opts.startDaysFromNow ?? -60) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(
    Date.now() + ((opts.startDaysFromNow ?? -60) + 2) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const { data: e, error: eErr } = await svc
    .from("events")
    .insert({
      tournament_id: t.id,
      owner_id: user.id,
      created_by: user.id,
      claimed: true,
      title: `Probe Event ${randomUUID().slice(0, 6)}`,
      lifecycle: "active",
      is_premium: opts.premium ?? false,
      start_date: startDate,
      end_date: endDate,
    })
    .select("id")
    .single();
  if (eErr) throw new Error(`event: ${eErr.message}`);
  return { tournamentId: t.id, eventId: e.id };
}
