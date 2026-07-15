"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";
import { postOnboardingDestination } from "@/lib/supabase/session";
import { isAdultDob } from "@/lib/validation";
import {
  ATTENDEE_ROLES,
  COMPETITION_LEVELS,
  DISTANCE_PREFS,
  ED_ROLES,
  ORG_OPTIONAL_ROLES,
  TEAM_GENDERS,
  USER_GENDERS,
  AGE_BRACKETS,
} from "@/lib/enums";

export type OnboardingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Step 1: first_name, last_name, role_title (within locked user_type),
 * organization_title (required unless the chosen role is parent_spectator).
 */
export async function saveStep1(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const role_title = String(formData.get("role_title") ?? "").trim();
  const organization_title = String(
    formData.get("organization_title") ?? "",
  ).trim();

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.first_name = "First name is required.";
  if (!last_name) fieldErrors.last_name = "Last name is required.";
  if (!role_title) fieldErrors.role_title = "Pick a role to continue.";

  const supabase = await createServerAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
  if (!profile) redirect("/login");

  const validRoles: readonly string[] =
    profile.user_type === "event_director"
      ? ED_ROLES.map((r) => r.value)
      : ATTENDEE_ROLES.map((r) => r.value);
  if (role_title && !validRoles.includes(role_title)) {
    fieldErrors.role_title = "That role doesn't match your account type.";
  }

  const orgRequired = !ORG_OPTIONAL_ROLES.has(role_title);
  if (orgRequired && !organization_title) {
    fieldErrors.organization_title =
      profile.user_type === "event_director"
        ? "Organization title is required."
        : "Club affiliation is required.";
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name,
      last_name,
      role_title,
      organization_title: organization_title || null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return {};
}

/**
 * Step 2: location (text for now — see DECISIONS §S0.5), gender, DOB.
 * Under-18 gets blocked with the "minor" copy the Auth spec calls for.
 */
export async function saveStep2(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const location = String(formData.get("location") ?? "").trim();
  const gender = String(formData.get("user_gender") ?? "").trim();
  const dob = String(formData.get("dob") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!location) fieldErrors.location = "Location is required.";
  if (!gender) fieldErrors.user_gender = "Pick one to continue.";
  if (!USER_GENDERS.some((g) => g.value === gender)) {
    fieldErrors.user_gender = "Pick one to continue.";
  }
  if (!dob) fieldErrors.dob = "Date of birth is required.";
  else if (!isAdultDob(dob)) {
    fieldErrors.dob =
      "You must be at least 18 to use Tournament Guru.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createServerAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      location_formatted: location,
      user_gender: gender,
      dob,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return {};
}

/**
 * Step 3: preferences — distance and up to 3 teams (1 for
 * parent_spectator). All optional per SCHEMA-DESIGN §11.
 * Attendees complete onboarding here; EDs advance to step 4.
 */
export async function saveStep3(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createServerAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type, role_title")
    .eq("id", user.id)
    .maybeSingle<{
      user_type: "attendee" | "event_director" | "admin";
      role_title: string;
    }>();
  if (!profile) redirect("/login");

  const distance = String(formData.get("distance_pref") ?? "").trim() || null;
  if (distance && !DISTANCE_PREFS.some((d) => d.value === distance)) {
    return { fieldErrors: { distance_pref: "Invalid distance option." } };
  }

  const maxSlots = profile.role_title === "parent_spectator" ? 1 : 3;
  type TeamRow = {
    profile_id: string;
    slot: number;
    team_gender: string | null;
    age: string | null;
    competition_level: string | null;
  };
  const teams: TeamRow[] = [];
  for (let slot = 1; slot <= maxSlots; slot++) {
    const team_gender =
      String(formData.get(`team_${slot}_gender`) ?? "").trim() || null;
    const age = String(formData.get(`team_${slot}_age`) ?? "").trim() || null;
    const level =
      String(formData.get(`team_${slot}_level`) ?? "").trim() || null;
    if (team_gender && !TEAM_GENDERS.some((t) => t.value === team_gender)) {
      return {
        fieldErrors: { [`team_${slot}_gender`]: "Invalid gender option." },
      };
    }
    if (age && !AGE_BRACKETS.includes(age as (typeof AGE_BRACKETS)[number])) {
      return { fieldErrors: { [`team_${slot}_age`]: "Invalid age option." } };
    }
    if (
      level &&
      !COMPETITION_LEVELS.some((c) => c.value === level)
    ) {
      return { fieldErrors: { [`team_${slot}_level`]: "Invalid level option." } };
    }
    if (team_gender || age || level) {
      teams.push({
        profile_id: user.id,
        slot,
        team_gender,
        age,
        competition_level: level,
      });
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ distance_pref: distance })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  // Replace-all semantics for the team slots the user filled.
  await supabase.from("user_teams").delete().eq("profile_id", user.id);
  if (teams.length) {
    const { error: teamsError } = await supabase.from("user_teams").insert(teams);
    if (teamsError) return { error: teamsError.message };
  }

  if (profile.user_type !== "event_director") {
    // Attendee → mark done + redirect out.
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    if (error) return { error: error.message };
    redirect(postOnboardingDestination(profile.user_type));
  }

  revalidatePath("/onboarding");
  return {};
}

/**
 * Step 4 (ED only): org description mandatory; org logo URL optional
 * (upload flow is deferred — see DECISIONS §S0.5). Completing this
 * step flips onboarding_completed and locks role_title + user_type.
 */
export async function saveStep4(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const org_description = String(formData.get("org_description") ?? "").trim();
  const org_logo_url = String(formData.get("org_logo_url") ?? "").trim() || null;

  const fieldErrors: Record<string, string> = {};
  if (!org_description) {
    fieldErrors.org_description = "Tell attendees who your organization is.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createServerAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      org_description,
      org_logo_url,
      onboarding_completed: true,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  redirect("/dashboard/events");
}
