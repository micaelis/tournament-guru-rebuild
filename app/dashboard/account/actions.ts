"use server";

import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";

export type AccountUpdateState = {
  error?: string;
  ok?: boolean;
};

/**
 * Save profile fields the account page exposes. Runs under the user's own
 * RLS (profiles: self update), so `.eq("id", user.id)` is a safety belt on
 * top of a policy that already scopes writes. Rejects when the session
 * evaporated between page load and submit.
 */
export async function updateAccount(
  _prev: AccountUpdateState,
  formData: FormData,
): Promise<AccountUpdateState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You've been signed out. Refresh and try again." };

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const clubAffiliation = String(
    formData.get("club_affiliation") ?? "",
  ).trim();
  const orgDescription = String(formData.get("org_description") ?? "").trim();
  const locationText = String(formData.get("location_text") ?? "").trim();

  // Notification prefs — each field's presence in the form data is true.
  const notif = (name: string) => formData.get(name) === "on";

  const payload = {
    first_name: firstName || null,
    last_name: lastName || null,
    full_name:
      firstName && lastName
        ? `${firstName} ${lastName}`
        : firstName || lastName || null,
    club_affiliation: clubAffiliation || null,
    org_description: orgDescription || null,
    location_text: locationText || null,
    email_fav_events: notif("email_fav_events"),
    inapp_fav_events: notif("inapp_fav_events"),
    email_review_likes: notif("email_review_likes"),
    inapp_review_likes: notif("inapp_review_likes"),
    email_event_reviews: notif("email_event_reviews"),
    inapp_event_reviews: notif("inapp_event_reviews"),
    email_review_comments: notif("email_review_comments"),
    inapp_review_comments: notif("inapp_review_comments"),
    email_comment_replies: notif("email_comment_replies"),
    inapp_comment_replies: notif("inapp_comment_replies"),
  };

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) {
    console.error("[dashboard/account] update failed", error);
    return { error: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  return { ok: true };
}
