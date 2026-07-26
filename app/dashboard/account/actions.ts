"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import {
  AGE_BRACKETS,
  COMPETITION_LEVELS,
  DISTANCE_PREFS,
  TEAM_GENDERS,
  USER_GENDERS,
  enumOrNull,
} from "@/lib/enums";
import { safeExternalUrl, safeImageSrc } from "@/lib/url";
import { siteUrl } from "@/lib/site-url";
import { parseGeoFields } from "@/lib/geo";
import { validateEmail, validatePassword } from "@/lib/validation";
import { buildNotifPatch } from "./notif-fields";
import type { Database } from "@/lib/database.types";

export type AccountState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  info?: string;
};

/**
 * Save the profile-tab fields. Column allow-list on `profiles` gates
 * what the client can write; this action just funnels the form data
 * through validation. user_type stays locked (grant excludes it +
 * lock trigger from Slice 0 §S0.4 catches any attempt).
 */
export async function updateProfile(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const organization_title =
    String(formData.get("organization_title") ?? "").trim() || null;
  const org_description = String(formData.get("org_description") ?? "").trim() || null;
  const org_logo_url =
    safeImageSrc(String(formData.get("org_logo_url") ?? "")) ?? null;
  const profile_photo_url =
    safeImageSrc(String(formData.get("profile_photo_url") ?? "")) ?? null;
  const location_formatted =
    String(formData.get("location_formatted") ?? "").trim() || null;
  const user_gender_raw =
    String(formData.get("user_gender") ?? "").trim() || null;
  const user_gender = enumOrNull(
    USER_GENDERS.map((g) => g.value),
    user_gender_raw,
  );

  const business_phone = String(formData.get("business_phone") ?? "").trim() || null;
  const business_email = String(formData.get("business_email") ?? "").trim() || null;
  const business_website =
    safeExternalUrl(String(formData.get("business_website") ?? "")) ?? null;

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.first_name = "First name is required.";
  if (!last_name) fieldErrors.last_name = "Last name is required.";
  if (user_gender_raw && !user_gender) {
    fieldErrors.user_gender = "Invalid gender.";
  }
  if (business_email) {
    const emailError = validateEmail(business_email);
    if (emailError) fieldErrors.business_email = emailError;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  // Partial update: the form renders different field sets per role
  // (location/gender/org are hidden for admins, the business block only
  // for EDs). Writing every column unconditionally turned an absent
  // input into "" -> null and silently wiped real data on save, so only
  // columns whose input was actually submitted are written.
  type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
  const patch: ProfileUpdate = { first_name, last_name };
  const setIfSubmitted = <K extends keyof ProfileUpdate>(
    field: K,
    value: ProfileUpdate[K],
  ) => {
    if (formData.has(field)) patch[field] = value;
  };

  setIfSubmitted("organization_title", organization_title);
  setIfSubmitted("org_description", org_description);
  setIfSubmitted("org_logo_url", org_logo_url);
  setIfSubmitted("profile_photo_url", profile_photo_url);
  setIfSubmitted("location_formatted", location_formatted);
  setIfSubmitted("user_gender", user_gender);
  setIfSubmitted("business_phone", business_phone);
  setIfSubmitted("business_email", business_email);
  setIfSubmitted("business_website", business_website);

  // The geo columns travel as hidden inputs inside LocationAutocomplete,
  // so they are present exactly when that component rendered.
  if (formData.has("location_lat")) {
    Object.assign(patch, parseGeoFields(formData));
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/account");
  return { info: "Profile updated." };
}

/**
 * Update the caller's email via Supabase auth. With secure email change
 * on, Supabase mails a confirmation link to BOTH the current and the new
 * address; the change applies only after both are clicked. The links
 * carry `emailRedirectTo` pointing at /auth/callback?next=/email-change
 * so every leg (first click, second click, expired link) lands on the
 * dedicated /email-change screen instead of the homepage.
 */
export async function updateEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const email = String(formData.get("email") ?? "").trim();
  const emailError = validateEmail(email);
  if (emailError) return { fieldErrors: { email: emailError } };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.email && email.toLowerCase() === user.email.toLowerCase()) {
    return {
      fieldErrors: { email: "That's already your sign-in email." },
    };
  }

  const site = await siteUrl();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${site}/auth/callback?next=/email-change` },
  );
  if (error) return { error: error.message };
  return {
    info: "Confirmation links are on their way to both your current and your new inbox — click the link in each to complete the change.",
  };
}

export async function updatePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const password = String(formData.get("password") ?? "");
  // Same rule as signup/reset — the server is authoritative, so the
  // full validatePassword policy applies here too, not just length.
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { fieldErrors: { password: passwordError } };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { info: "Password updated." };
}

/**
 * Delete-my-account. Routes to the role-appropriate RPC:
 * - Attendee → soft_delete_attendee (delete their reviews + comments,
 *   scrub identity)
 * - ED → delete_ed_account (reset claimed events, delete created
 *   ones, then the same delete + scrub)
 * - Admin → NOT allowed via this action; admins can't self-delete.
 *
 * Requires the caller to re-enter their password (S8.2 / RG1 M4) —
 * the sign-in call inside the action is authoritative even if the
 * client bypasses its own confirmation. Signs out at the end and
 * lands the user on /login.
 */
export async function deleteMyAccount(password: string): Promise<AccountState> {
  if (!password) {
    return {
      fieldErrors: {
        password: "Enter your current password to confirm.",
      },
    };
  }

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.email) return { error: "No email on file for this account." };

  const reauth = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (reauth.error) {
    return {
      fieldErrors: {
        password: "That password doesn't match our records.",
      },
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
  if (!profile) return { error: "Profile not found." };
  if (profile.user_type === "admin") {
    return { error: "Admin accounts can't be self-deleted." };
  }

  const rpc =
    profile.user_type === "event_director"
      ? "delete_ed_account"
      : "soft_delete_attendee";
  const { error } = await supabase.rpc(rpc, { target_user: user.id });
  if (error) return { error: error.message };
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}

/** Update Screen-3-style team info (up to 3 slots, 1 for
 * parent_spectator). Same replace-all semantics as onboarding. */
export async function updateTeams(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role_title")
    .eq("id", user.id)
    .maybeSingle<{ role_title: string }>();
  if (!profile) return { error: "Profile not found." };
  const maxSlots = profile.role_title === "parent_spectator" ? 1 : 3;

  const distanceRaw =
    String(formData.get("distance_pref") ?? "").trim() || null;
  const distance_pref = enumOrNull(
    DISTANCE_PREFS.map((d) => d.value),
    distanceRaw,
  );
  if (distanceRaw && !distance_pref) {
    return { fieldErrors: { distance_pref: "Invalid distance option." } };
  }

  const rows: Database["public"]["Tables"]["user_teams"]["Insert"][] = [];
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
    // A tampered enum value narrows to null; reject rather than store a
    // silently different team than the form claimed to save.
    if ((genderRaw && !team_gender) || (ageRaw && !age) || (levelRaw && !competition_level)) {
      return { fieldErrors: { [`team_${slot}_gender`]: "Invalid team selection." } };
    }
    if (team_gender || age || competition_level) {
      rows.push({
        profile_id: user.id,
        slot,
        team_gender,
        age,
        competition_level,
      });
    }
  }

  const { error: prefError } = await supabase
    .from("profiles")
    .update({ distance_pref })
    .eq("id", user.id);
  if (prefError) return { error: prefError.message };

  // Replace-all slots — the delete has to be checked or a clear-all
  // reports success while the old teams survive (and the insert below
  // then collides with them on the unique-slot index).
  const { error: clearError } = await supabase
    .from("user_teams")
    .delete()
    .eq("profile_id", user.id);
  if (clearError) return { error: clearError.message };

  if (rows.length) {
    const { error } = await supabase.from("user_teams").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/account");
  return { info: "Team info updated." };
}

export async function updateNotificationPrefs(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Partial-update rule + FormData contract live in notif-fields.ts
  // (shared with the unit test): only sections whose marker was
  // submitted are written, absent switch = false.
  const patch = buildNotifPatch(formData);
  if (Object.keys(patch).length === 0) {
    return { info: "Notification preferences updated." };
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { error: error.message };
  // Keep the server-rendered props honest — without this, a client-side
  // return to the page re-renders the switches from stale prefetch data
  // (the S12.10 save-reset bug's server half; the client half is the
  // controlled switches in AccountClient).
  revalidatePath("/dashboard/account");
  return { info: "Notification preferences updated." };
}

