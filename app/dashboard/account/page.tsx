import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { AccountClient } from "./AccountClient";

/**
 * Account hub — server component that loads the user's profile row +
 * team slots + notification prefs and hands them to a client wrapper
 * that owns the tab UI + form actions.
 */
export default async function AccountPage() {
  const { profile, user } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();

  const [{ data: fullProfile }, { data: teams }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, user_type, role_title, first_name, last_name, dob, user_gender, organization_title, org_description, org_logo_url, profile_photo_url, location_formatted, distance_pref, email_review_replies, inapp_review_replies, email_review_likes, inapp_review_likes, email_comment_replies, inapp_comment_replies, email_event_reviews, inapp_event_reviews, email_favorited_events, inapp_favorited_events",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_teams")
      .select("id, slot, team_gender, age, competition_level")
      .eq("profile_id", user.id)
      .order("slot"),
  ]);

  return (
    <AccountClient
      email={user.email ?? ""}
      profile={fullProfile as any}
      teams={(teams ?? []) as any}
      userType={profile.user_type}
    />
  );
}
