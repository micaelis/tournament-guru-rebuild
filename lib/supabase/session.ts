import { redirect } from "next/navigation";
import { createServerAuthClient } from "./server";

/**
 * The subset of `profiles` the dashboard shell reads.
 * Kept narrow so RLS + column exposure stay minimal.
 */
export type DashboardProfile = {
  id: string;
  user_type: "admin" | "company" | "attendee" | "event_director";
  full_name: string | null;
  contact_email: string | null;
  profile_picture: string | null;
  onboarding_complete: boolean;
};

/**
 * Server-only helper — fetch the auth session AND the app profile in one place.
 * Returns null when either is missing so callers can decide how to react
 * (the middleware already gates protected routes; this is a defensive net).
 */
export async function getSessionAndProfile(): Promise<
  { user: { id: string; email: string | null }; profile: DashboardProfile } | null
> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, user_type, full_name, contact_email, profile_picture, onboarding_complete",
    )
    .eq("id", user.id)
    .maybeSingle<DashboardProfile>();

  if (!profile) return null;
  return { user: { id: user.id, email: user.email ?? null }, profile };
}

/**
 * Convenience wrapper for pages that require a signed-in user with a profile.
 * Sends users to /login (no session) or /onboarding (no profile row — should
 * only happen if the auth trigger failed). Returns a non-null value on success.
 */
export async function requireSessionAndProfile(): Promise<{
  user: { id: string; email: string | null };
  profile: DashboardProfile;
}> {
  const result = await getSessionAndProfile();
  if (!result) redirect("/login");
  if (!result.profile.onboarding_complete) redirect("/onboarding");
  return result;
}
