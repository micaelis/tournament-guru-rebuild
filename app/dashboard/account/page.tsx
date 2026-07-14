import type { Metadata } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { AccountEditor } from "./parts";

export const metadata: Metadata = {
  title: "Account · Dashboard · Tournament Guru",
};

/** Full public/writable fields the account page reads from `profiles`.
 *  Wider than DashboardProfile because the editor exposes fields
 *  requireSessionAndProfile doesn't fetch (org description, notification
 *  prefs, etc.). */
type AccountFields = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  contact_email: string | null;
  club_affiliation: string | null;
  org_description: string | null;
  org_logo: string | null;
  location_text: string | null;
  user_type: "admin" | "event_director" | "attendee" | "company";
  attendee_type: string | null;
  total_events: number | null;
  total_reviews: number | null;
  email_fav_events: boolean | null;
  inapp_fav_events: boolean | null;
  email_review_likes: boolean | null;
  inapp_review_likes: boolean | null;
  email_event_reviews: boolean | null;
  inapp_event_reviews: boolean | null;
  email_review_comments: boolean | null;
  inapp_review_comments: boolean | null;
  email_comment_replies: boolean | null;
  inapp_comment_replies: boolean | null;
};

export default async function DashboardAccountPage() {
  const { profile } = await requireSessionAndProfile();

  // Layout already gate-checked auth; fetch the wider slice of fields the
  // editor renders. Fails soft if RLS blocks a column (impossible under
  // self-select, but the null coalescing keeps the page rendering).
  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      `
      first_name, last_name, full_name, contact_email, club_affiliation,
      org_description, org_logo, location_text, user_type, attendee_type,
      total_events, total_reviews,
      email_fav_events, inapp_fav_events,
      email_review_likes, inapp_review_likes,
      email_event_reviews, inapp_event_reviews,
      email_review_comments, inapp_review_comments,
      email_comment_replies, inapp_comment_replies
    `,
    )
    .eq("id", profile.id)
    .maybeSingle<AccountFields>();

  const fields: AccountFields = data ?? {
    first_name: null,
    last_name: null,
    full_name: profile.full_name,
    contact_email: profile.contact_email,
    club_affiliation: null,
    org_description: null,
    org_logo: null,
    location_text: null,
    user_type: profile.user_type,
    attendee_type: null,
    total_events: 0,
    total_reviews: 0,
    email_fav_events: true,
    inapp_fav_events: true,
    email_review_likes: true,
    inapp_review_likes: true,
    email_event_reviews: true,
    inapp_event_reviews: true,
    email_review_comments: true,
    inapp_review_comments: true,
    email_comment_replies: true,
    inapp_comment_replies: true,
  };

  return <AccountEditor fields={fields} />;
}
