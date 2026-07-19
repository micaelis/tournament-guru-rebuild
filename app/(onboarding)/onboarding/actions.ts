"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";
import { isAdultDob } from "@/lib/validation";
import { parseGeoFields } from "@/lib/geo";
import {
  COMPETITION_LEVELS,
  DISTANCE_PREFS,
  ORG_OPTIONAL_ROLES,
  TEAM_GENDERS,
  USER_GENDERS,
  AGE_BRACKETS,
  enumOrNull,
} from "@/lib/enums";
import type { Database } from "@/lib/database.types";

export type OnboardingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Step 1: first_name, last_name, organization_title (required unless the
 * chosen role is parent_spectator). Role is captured during signup and is
 * no longer asked here.
 */
export async function saveStep1(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const organization_title = String(
    formData.get("organization_title") ?? "",
  ).trim();

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.first_name = "First name is required.";
  if (!last_name) fieldErrors.last_name = "Last name is required.";

  const supabase = await createServerAuthClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type, role_title")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin"; role_title: string }>();
  if (!profile) redirect("/login");

  const orgRequired = !ORG_OPTIONAL_ROLES.has(profile.role_title);
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
      organization_title: organization_title || null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return {};
}

/**
 * Step 2: location (Places-backed; geo fields ride hidden inputs and are
 * null for hand-typed text), gender, DOB. Under-18 gets blocked with the
 * "minor" copy the Auth spec calls for.
 */
export async function saveStep2(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const location = String(formData.get("location") ?? "").trim();
  const gender = enumOrNull(
    USER_GENDERS.map((g) => g.value),
    String(formData.get("user_gender") ?? "").trim(),
  );
  const dob = String(formData.get("dob") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!location) fieldErrors.location = "Location is required.";
  if (!gender) fieldErrors.user_gender = "Pick one to continue.";
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
      ...parseGeoFields(formData),
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

  const distanceRaw = String(formData.get("distance_pref") ?? "").trim() || null;
  const distance = enumOrNull(
    DISTANCE_PREFS.map((d) => d.value),
    distanceRaw,
  );
  if (distanceRaw && !distance) {
    return { fieldErrors: { distance_pref: "Invalid distance option." } };
  }

  const maxSlots = profile.role_title === "parent_spectator" ? 1 : 3;
  const teams: Database["public"]["Tables"]["user_teams"]["Insert"][] = [];
  for (let slot = 1; slot <= maxSlots; slot++) {
    const genderRaw =
      String(formData.get(`team_${slot}_gender`) ?? "").trim() || null;
    const ageRaw = String(formData.get(`team_${slot}_age`) ?? "").trim() || null;
    const levelRaw =
      String(formData.get(`team_${slot}_level`) ?? "").trim() || null;
    const team_gender = enumOrNull(
      TEAM_GENDERS.map((t) => t.value),
      genderRaw,
    );
    const age = enumOrNull(AGE_BRACKETS, ageRaw);
    const competition_level = enumOrNull(
      COMPETITION_LEVELS.map((c) => c.value),
      levelRaw,
    );
    if (genderRaw && !team_gender) {
      return {
        fieldErrors: { [`team_${slot}_gender`]: "Invalid gender option." },
      };
    }
    if (ageRaw && !age) {
      return { fieldErrors: { [`team_${slot}_age`]: "Invalid age option." } };
    }
    if (levelRaw && !competition_level) {
      return { fieldErrors: { [`team_${slot}_level`]: "Invalid level option." } };
    }
    if (team_gender || age || competition_level) {
      teams.push({
        profile_id: user.id,
        slot,
        team_gender,
        age,
        competition_level,
      });
    }
  }

  // Flip preferences_completed so the wizard's step-picker has an
  // explicit signal that this step ran, even when the user skipped
  // every optional field (see DECISIONS §RG1.H2).
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ distance_pref: distance, preferences_completed: true })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  // Replace-all semantics for the team slots the user filled. A failed
  // delete must surface: swallowing it either strands stale teams (all
  // slots cleared) or turns the re-insert into a unique-slot violation.
  const { error: teamsDeleteError } = await supabase
    .from("user_teams")
    .delete()
    .eq("profile_id", user.id);
  if (teamsDeleteError) return { error: teamsDeleteError.message };
  if (teams.length) {
    const { error: teamsError } = await supabase.from("user_teams").insert(teams);
    if (teamsError) return { error: teamsError.message };
  }

  if (profile.user_type !== "event_director") {
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    if (error) return { error: error.message };
    redirect("/onboarding/success");
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

  redirect("/onboarding/success");
}
