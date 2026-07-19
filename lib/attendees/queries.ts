import "server-only";
import { createAnonServerClient } from "@/lib/supabase/server";
import { unwrap, unwrapRows } from "@/lib/supabase/unwrap";

/**
 * Public attendee profile reads. Identity comes ONLY from the
 * public_attendees SECURITY DEFINER view — first name + last initial
 * ("Ashley M."), never last_name / email / dob. Review aggregates are
 * derived from the author's PUBLISHED reviews (RLS keeps hidden rows
 * out), split into the two capacities the page shows: verified coach
 * vs attendee, matching the reviewer_role='coach' split used for
 * director ratings.
 */

export type AttendeePublicProfile = {
  id: string;
  /** "Ashley M." — the public name rule. */
  display_name: string;
  profile_photo_url: string | null;
  /** "City, ST" (falls back to the formatted location). */
  location: string | null;
  role_title: string;
  club_affiliation: string | null;
  total_published: number;
  coach_rating: number;
  coach_reviews: number;
  attendee_rating: number;
  attendee_reviews: number;
};

export async function getAttendeePublicProfile(
  id: string,
): Promise<AttendeePublicProfile | null> {
  const supabase = createAnonServerClient();
  // unwrap: a query failure must throw, not 404 a live profile.
  const { data } = unwrap(
    await supabase
      .from("public_attendees")
      .select(
        "id, first_name, last_initial, profile_photo_url, location_city, location_state_abbr, location_formatted, role_title, organization_title",
      )
      .eq("id", id)
      .maybeSingle(),
    "getAttendeePublicProfile attendee",
  );
  // No row (deleted / blocked / not an attendee) or no public name yet
  // (onboarding incomplete) → the page 404s.
  if (!data || !data.first_name || !data.role_title) return null;

  const rows = unwrapRows<{
    overall: number | null;
    reviewer_role: string | null;
  }>(
    await supabase
      .from("reviews")
      .select("overall, reviewer_role")
      .eq("author_id", id)
      .eq("status", "published"),
    "getAttendeePublicProfile reviews",
  );

  let coachSum = 0,
    coachRated = 0,
    coachN = 0,
    attSum = 0,
    attRated = 0,
    attN = 0;
  for (const r of rows) {
    const o = Number(r.overall ?? 0);
    if (r.reviewer_role === "coach") {
      coachN++;
      if (o > 0) {
        coachSum += o;
        coachRated++;
      }
    } else {
      attN++;
      if (o > 0) {
        attSum += o;
        attRated++;
      }
    }
  }

  const location =
    data.location_city && data.location_state_abbr
      ? `${data.location_city}, ${data.location_state_abbr}`
      : data.location_formatted;

  return {
    id,
    display_name: data.last_initial
      ? `${data.first_name} ${data.last_initial}.`
      : data.first_name,
    profile_photo_url: data.profile_photo_url,
    location,
    role_title: data.role_title,
    club_affiliation: data.organization_title,
    total_published: rows.length,
    coach_rating: coachRated ? coachSum / coachRated : 0,
    coach_reviews: coachN,
    attendee_rating: attRated ? attSum / attRated : 0,
    attendee_reviews: attN,
  };
}

/** Live event titles for the page's review-context chips. Detached
 * reviews fall back to their snapshot title without a link. */
export async function getEventTitles(
  eventIds: string[],
): Promise<Record<string, string>> {
  if (eventIds.length === 0) return {};
  const supabase = createAnonServerClient();
  const rows = unwrapRows<{ id: string; title: string }>(
    await supabase.from("events").select("id, title").in("id", eventIds),
    "getEventTitles events",
  );
  const map: Record<string, string> = {};
  for (const r of rows) if (r.id && r.title) map[r.id] = r.title;
  return map;
}
