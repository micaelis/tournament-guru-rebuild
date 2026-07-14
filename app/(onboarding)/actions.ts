"use server";

import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import {
  ROLE_VALUES,
  ORG_ROLES,
  ORG_REQUIRED,
  USER_GENDER_VALUES,
  DISTANCE_VALUES,
  COMPETITION_LEVEL_VALUES,
  TEAM_GENDER_VALUES,
  AGE_VALUES,
} from "@/app/lib/onboarding-options";

export type OnboardingState = { error?: string };

type TeamInput = { gender?: string; age?: string; level?: string };

/** Age in whole years from an ISO yyyy-mm-dd string, ignoring time zones. */
function ageInYears(dobISO: string, now = new Date()): number {
  const dob = new Date(dobISO + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return -1;
  let years = now.getFullYear() - dob.getFullYear();
  const beforeBirthdayThisYear =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthdayThisYear) years -= 1;
  return years;
}

/**
 * Writes everything the wizard collected: profile fields + one team, and flips
 * onboarding_complete. Runs under the user's own RLS (profiles: self update,
 * user_teams: owner all). Only writes `profiles.location_text` — the geo
 * `profiles.location` column is left alone so PostGIS parsing can never block
 * onboarding.
 */
export async function finishOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const orgName = String(formData.get("org_name") ?? "").trim();
  const locationText = String(formData.get("location_text") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const dob = String(formData.get("dob") ?? "").trim();
  const prefDistance = String(formData.get("pref_distance") ?? "").trim();

  // ── Required-field validation (mirrors the wizard's client-side rules so the
  //    server is authoritative even if a form is posted directly) ──
  if (!firstName || !lastName) {
    return { error: "Please enter your first and last name." };
  }
  if (!ROLE_VALUES.includes(role)) {
    return {
      error: "Please choose whether you're a coach, parent, or manager.",
    };
  }
  if (
    ORG_REQUIRED.includes(role as (typeof ORG_REQUIRED)[number]) &&
    !orgName
  ) {
    return { error: "Team Managers must enter an organization name." };
  }
  if (!locationText) {
    return { error: "Please enter your location." };
  }
  if (!USER_GENDER_VALUES.includes(gender)) {
    return { error: "Please choose an option for gender." };
  }
  if (!dob) {
    return { error: "Please enter your date of birth." };
  }
  if (ageInYears(dob) < 18) {
    return { error: "You need to be 18+ to use Tournament Guru." };
  }
  if (prefDistance && !DISTANCE_VALUES.includes(prefDistance)) {
    return { error: "Please choose a valid distance preference." };
  }

  // Teams — Bubble supported three slots on the user table. Team Managers can
  // register up to 3; every other role registers a single team. We keep only
  // fully-specified rows (every field chosen) so partial forms don't fail RLS
  // on missing required columns.
  const maxTeams = role === "team_manager" ? 3 : 1;
  let teamsRaw: TeamInput[] = [];
  try {
    const raw = formData.get("teams");
    if (typeof raw === "string" && raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) teamsRaw = parsed;
    }
  } catch {
    teamsRaw = [];
  }
  const validTeams = teamsRaw
    .filter(
      (t) =>
        t &&
        TEAM_GENDER_VALUES.includes(t.gender ?? "") &&
        AGE_VALUES.includes(t.age ?? "") &&
        COMPETITION_LEVEL_VALUES.includes(t.level ?? ""),
    )
    .slice(0, maxTeams);

  // Only pass through org name when the role opted into the org field.
  const clubAffiliation =
    ORG_ROLES.includes(role as (typeof ORG_ROLES)[number]) && orgName
      ? orgName
      : null;

  // ── Write profile — upsert on id so the wizard finishes cleanly even if the
  //    handle_new_user() trigger hasn't been applied and no profile row exists
  //    yet. No geo columns are touched, so PostGIS never runs. Returning the
  //    updated row also tells us clearly when 0 rows landed (which is why the
  //    previous update-only path silently redirected without persisting). ──
  const { data: saved, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        contact_email: user.email ?? null,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        attendee_type: role,
        club_affiliation: clubAffiliation,
        location_text: locationText,
        gender,
        dob,
        pref_distance: prefDistance || null,
        pref_competition: validTeams[0]?.level ?? null,
        onboarding_complete: true,
        onboarding_step: "finished",
      },
      { onConflict: "id" },
    )
    .select("id, onboarding_complete")
    .maybeSingle();

  if (!profileError && !saved) {
    console.error("[onboarding] upsert returned no row", { userId: user.id });
    return {
      error:
        "Couldn't save your profile (no rows written). Check profiles RLS / GRANTs.",
    };
  }

  if (profileError) {
    // Log the raw error so we can see it in server logs, and surface a short
    // form to the user so we stop losing the actual cause behind a generic
    // "something went wrong" message.
    console.error("[onboarding] profile update failed", {
      userId: user.id,
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
      message: profileError.message,
    });
    const detail = profileError.message || profileError.details || "unknown";
    return {
      error: `Couldn't save your profile: ${detail}`,
    };
  }

  // ── Replace teams (idempotent if the user re-runs onboarding) ──
  const { error: deleteError } = await supabase
    .from("user_teams")
    .delete()
    .eq("profile_id", user.id);
  if (deleteError) {
    console.error("[onboarding] team clear failed", deleteError);
    // Non-fatal for the finish flow — profile is already saved.
  }
  if (validTeams.length > 0) {
    const rows = validTeams.map((t, i) => ({
      profile_id: user.id,
      slot: i + 1,
      gender: t.gender!,
      age: t.age!,
      level: t.level!,
    }));
    const { error: teamError } = await supabase.from("user_teams").insert(rows);
    if (teamError) {
      console.error("[onboarding] team insert failed", teamError);
      return {
        error: `Your profile was saved, but your teams didn't save: ${teamError.message}`,
      };
    }
  }

  redirect("/");
}
