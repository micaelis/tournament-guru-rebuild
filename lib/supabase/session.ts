import { redirect } from "next/navigation";
import { createServerAuthClient } from "./server";

/**
 * Narrow projection of `profiles` used by the dashboard shell and route
 * guards. Deliberately excludes PII (email, dob) and moderation flags —
 * anything a page-level surface needs those for should query them
 * directly and rely on RLS + column grants for enforcement.
 */
export type SessionProfile = {
  id: string;
  user_type: "admin" | "event_director" | "attendee";
  role_title:
    | "event_director"
    | "event_admin"
    | "club_director"
    | "coach"
    | "parent_spectator"
    | "team_manager";
  first_name: string | null;
  last_name: string | null;
  profile_photo_url: string | null;
  organization_title: string | null;
  onboarding_completed: boolean;
  blocked: boolean;
};

const PROFILE_COLUMNS =
  "id, user_type, role_title, first_name, last_name, profile_photo_url, organization_title, onboarding_completed, blocked";

/**
 * Server-only helper — fetch the auth user AND their app profile in one
 * place. Returns null when either is missing so callers can decide what
 * to do (middleware handles the common cases; this is the last-mile net).
 */
export async function getSessionAndProfile(): Promise<
  { user: { id: string; email: string | null }; profile: SessionProfile } | null
> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<SessionProfile>();

  if (!profile) return null;
  return { user: { id: user.id, email: user.email ?? null }, profile };
}

/**
 * Require a signed-in user with a completed onboarding.
 * - No session          → /login
 * - Blocked profile     → /login?error=blocked (middleware also handles this)
 * - Incomplete profile  → /onboarding
 */
export async function requireSessionAndProfile(): Promise<{
  user: { id: string; email: string | null };
  profile: SessionProfile;
}> {
  const result = await getSessionAndProfile();
  if (!result) redirect("/login");
  if (result.profile.blocked) redirect("/login?error=blocked");
  if (!result.profile.onboarding_completed) redirect("/onboarding");
  return result;
}

/**
 * Where a role belongs after finishing onboarding.
 * - Attendee → public search-events (their "dashboard" for browsing is
 *   the public page; per-account tabs live under /dashboard).
 * - ED / Admin → the dashboard shell.
 */
export function postOnboardingDestination(
  userType: SessionProfile["user_type"],
): string {
  if (userType === "attendee") return "/events";
  return "/dashboard/events";
}
