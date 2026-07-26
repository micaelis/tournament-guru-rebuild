import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrap, unwrapRows } from "@/lib/supabase/unwrap";
import { AccountClient, type AccountProfile, type AccountTeam } from "./AccountClient";

/**
 * Account hub — server component that loads the user's profile row +
 * team slots + notification prefs and hands them to a client wrapper
 * that owns the tab UI + form actions.
 */
export default async function AccountPage() {
  const { profile, user } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();

  // unwrap: a failed read must throw, not hand the settings form a null
  // profile / empty team slots that a later save would persist.
  const [{ data: fullProfile }, teams] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, user_type, role_title, created_at, first_name, last_name, dob, user_gender, organization_title, org_description, org_logo_url, profile_photo_url, business_phone, business_email, business_website, location_formatted, location_lat, location_lng, location_place_id, location_city, location_state_full, location_state_abbr, location_zip, distance_pref, email_review_replies, inapp_review_replies, email_review_likes, inapp_review_likes, email_comment_replies, inapp_comment_replies, email_event_reviews, inapp_event_reviews, email_favorited_events, inapp_favorited_events",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then((r) => unwrap(r, "AccountPage profile")),
    supabase
      .from("user_teams")
      .select("id, slot, team_gender, age, competition_level")
      .eq("profile_id", user.id)
      .order("slot")
      .then((r) => unwrapRows(r, "AccountPage teams")),
  ]);

  return (
    <AccountClient
      email={user.email ?? ""}
      emailVerified={Boolean(user.emailConfirmedAt)}
      profile={fullProfile as unknown as AccountProfile}
      teams={teams as unknown as AccountTeam[]}
      userType={profile.user_type}
    />
  );
}
