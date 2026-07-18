"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { DISTANCE_PREFS, USER_GENDERS } from "@/lib/enums";
import { safeExternalUrl, safeImageSrc } from "@/lib/url";
import { parseGeoFields } from "@/lib/geo";

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
  const user_gender = String(formData.get("user_gender") ?? "").trim() || null;

  const business_phone = String(formData.get("business_phone") ?? "").trim() || null;
  const business_email = String(formData.get("business_email") ?? "").trim() || null;
  const business_website =
    safeExternalUrl(String(formData.get("business_website") ?? "")) ?? null;

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.first_name = "First name is required.";
  if (!last_name) fieldErrors.last_name = "Last name is required.";
  if (
    user_gender &&
    !USER_GENDERS.some((g) => g.value === user_gender)
  ) {
    fieldErrors.user_gender = "Invalid gender.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name,
      last_name,
      organization_title,
      org_description,
      org_logo_url,
      profile_photo_url,
      location_formatted,
      ...parseGeoFields(formData),
      user_gender,
      business_phone,
      business_email,
      business_website,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/account");
  return { info: "Profile updated." };
}

/** Update the caller's email via Supabase auth. Requires confirm. */
export async function updateEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { fieldErrors: { email: "Enter a new email address." } };
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { error: error.message };
  return {
    info: "Check both your old and new inbox — Supabase sends a confirmation link before the change takes effect.",
  };
}

export async function updatePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return {
      fieldErrors: {
        password: "Password needs at least 8 characters.",
      },
    };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { info: "Password updated." };
}

/**
 * Delete-my-account. Routes to the role-appropriate RPC:
 * - Attendee → soft_delete_attendee (anonymize + scrub identity)
 * - ED → delete_ed_account (reset claimed events, delete created
 *   ones, then attendee scrub)
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

  const distance_pref = String(formData.get("distance_pref") ?? "").trim() || null;
  if (
    distance_pref &&
    !DISTANCE_PREFS.some((d) => d.value === distance_pref)
  ) {
    return { fieldErrors: { distance_pref: "Invalid distance option." } };
  }

  type TeamRow = {
    profile_id: string;
    slot: number;
    team_gender: string | null;
    age: string | null;
    competition_level: string | null;
  };
  const rows: TeamRow[] = [];
  for (let slot = 1; slot <= maxSlots; slot++) {
    const team_gender =
      String(formData.get(`team_${slot}_gender`) ?? "").trim() || null;
    const age = String(formData.get(`team_${slot}_age`) ?? "").trim() || null;
    const level =
      String(formData.get(`team_${slot}_level`) ?? "").trim() || null;
    if (team_gender || age || level) {
      rows.push({
        profile_id: user.id,
        slot,
        team_gender,
        age,
        competition_level: level,
      });
    }
  }

  await supabase
    .from("profiles")
    .update({ distance_pref })
    .eq("id", user.id);
  await supabase.from("user_teams").delete().eq("profile_id", user.id);
  if (rows.length) {
    const { error } = await supabase.from("user_teams").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/account");
  return { info: "Team info updated." };
}

const NOTIF_FIELDS = [
  "email_review_replies",
  "inapp_review_replies",
  "email_review_likes",
  "inapp_review_likes",
  "email_comment_replies",
  "inapp_comment_replies",
  "email_event_reviews",
  "inapp_event_reviews",
  "email_favorited_events",
  "inapp_favorited_events",
] as const;

export async function updateNotificationPrefs(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const patch: Record<string, boolean> = {};
  for (const field of NOTIF_FIELDS) {
    patch[field] = formData.get(field) === "on";
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { error: error.message };
  return { info: "Notification preferences updated." };
}

