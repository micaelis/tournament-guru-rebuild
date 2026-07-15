import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { postOnboardingDestination } from "@/lib/supabase/session";
import OnboardingWizard from "./OnboardingWizard";
import { ORG_OPTIONAL_ROLES } from "@/lib/enums";

/**
 * Step is derived from the saved profile: we walk the mandatory-field
 * set in order and land on the first incomplete step. The user can't
 * skip ahead by URL-hacking because the server actions re-check every
 * field before advancing.
 */
type ProfileSlice = {
  user_type: "attendee" | "event_director" | "admin";
  role_title: string;
  first_name: string | null;
  last_name: string | null;
  organization_title: string | null;
  location_formatted: string | null;
  user_gender: string | null;
  dob: string | null;
  distance_pref: string | null;
  org_description: string | null;
  org_logo_url: string | null;
  onboarding_completed: boolean;
};

function step1Done(p: ProfileSlice): boolean {
  if (!p.first_name || !p.last_name) return false;
  if (!ORG_OPTIONAL_ROLES.has(p.role_title) && !p.organization_title) {
    return false;
  }
  return true;
}

function step2Done(p: ProfileSlice): boolean {
  return Boolean(p.location_formatted && p.user_gender && p.dob);
}

function step3Done(p: ProfileSlice): boolean {
  // Attendee: step 3 is the final step and all fields are optional.
  // We treat the user finishing step 3 (server sets onboarding_completed)
  // as done. So if we're on this page and onboarding_completed is false
  // for an attendee, step 3 hasn't been submitted yet. For ED, step 3
  // "done" means we've passed it — mark complete when distance_pref is
  // set or when the user_teams table has ≥1 row.
  // For simplicity: the wizard advances via the ED action, which does
  // NOT set a step-3-done flag on the profile. So we use a proxy: if
  // the user has ANY user_teams row OR distance_pref is set, treat as
  // done. Otherwise show it once and let the user submit (even empty)
  // to advance.
  return p.distance_pref !== null;
}

export default async function OnboardingPage() {
  const supabase = await createServerAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "user_type, role_title, first_name, last_name, organization_title, location_formatted, user_gender, dob, distance_pref, org_description, org_logo_url, onboarding_completed",
    )
    .eq("id", userData.user.id)
    .maybeSingle<ProfileSlice>();
  if (!profile) redirect("/login");

  if (profile.onboarding_completed) {
    redirect(postOnboardingDestination(profile.user_type));
  }

  const step = !step1Done(profile)
    ? 1
    : !step2Done(profile)
      ? 2
      : profile.user_type === "event_director" && step3Done(profile)
        ? 4
        : 3;

  return (
    <OnboardingWizard
      step={step}
      userType={profile.user_type}
      profile={{
        first_name: profile.first_name,
        last_name: profile.last_name,
        role_title: profile.role_title,
        organization_title: profile.organization_title,
        location_formatted: profile.location_formatted,
        user_gender: profile.user_gender,
        dob: profile.dob,
        distance_pref: profile.distance_pref,
        org_description: profile.org_description,
        org_logo_url: profile.org_logo_url,
      }}
    />
  );
}
