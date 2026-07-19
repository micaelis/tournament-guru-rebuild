"use server";

import { createServerAuthClient } from "@/lib/supabase/server";

export type ReviewerPool = { avg: number | null; count: number };

export type ReviewerDetails = {
  /** For the "View public profile" link (/attendees/[id]). */
  authorId: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  photoUrl: string | null;
  city: string | null;
  stateAbbr: string | null;
  publishedCount: number;
  teams: {
    slot: number;
    gender: string | null;
    age: string | null;
    level: string | null;
  }[];
  coachPool: ReviewerPool;
  attendeePool: ReviewerPool;
};

export type ReviewerDetailsState =
  | { details: ReviewerDetails; error?: never }
  | { error: string; details?: never };

/**
 * Reviewer-details popup data (spec §6.2, S2.7). Keyed by REVIEW id so
 * the caller has to be able to see the review before the reviewer
 * resolves. Identity flows through what RLS already exposes — the
 * direct profiles/user_teams reads succeed for admins (the is_admin()
 * arm) and come back empty for EDs, who fall back to the public
 * `review_author_public` view. No grant is widened for this popup;
 * the two roles simply see different depths. The rating pools come
 * from published reviews (readable to both): Verified Coach = written
 * with a promo (`guru_review`), Attendee = without.
 */
export async function getReviewerDetails(
  reviewId: string,
): Promise<ReviewerDetailsState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("author_id, anonymized")
    .eq("id", reviewId)
    .maybeSingle<{ author_id: string | null; anonymized: boolean }>();
  if (reviewError) return { error: reviewError.message };
  if (!review || review.anonymized || !review.author_id) {
    return { error: "This reviewer is no longer available." };
  }
  const authorId = review.author_id;

  // Admin path: the profiles/user_teams admin RLS arms return the row;
  // for an ED both come back empty and the public view fills identity.
  const [profileRes, publicRes, teamsRes, poolRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "first_name, last_name, organization_title, profile_photo_url, location_city, location_state_abbr",
      )
      .eq("id", authorId)
      .maybeSingle<{
        first_name: string | null;
        last_name: string | null;
        organization_title: string | null;
        profile_photo_url: string | null;
        location_city: string | null;
        location_state_abbr: string | null;
      }>(),
    supabase
      .from("review_author_public")
      .select("first_name, organization_title, profile_photo_url")
      .eq("review_id", reviewId)
      .maybeSingle<{
        first_name: string | null;
        organization_title: string | null;
        profile_photo_url: string | null;
      }>(),
    supabase
      .from("user_teams")
      .select("slot, team_gender, age, competition_level")
      .eq("profile_id", authorId)
      .order("slot"),
    supabase
      .from("reviews")
      .select("overall, guru_review")
      .eq("author_id", authorId)
      .eq("status", "published"),
  ]);
  // Failed reads surface — a popup quietly missing its pools or teams
  // reads as "this reviewer has none" (the S8.9 class).
  for (const res of [profileRes, publicRes, teamsRes, poolRes]) {
    if (res.error) return { error: res.error.message };
  }

  const profile = profileRes.data;
  const pub = publicRes.data;

  const pool = (guru: boolean): ReviewerPool => {
    const rows = (poolRes.data ?? []).filter(
      (r: { overall: number | null; guru_review: boolean }) =>
        r.guru_review === guru && r.overall !== null,
    );
    const count = rows.length;
    const avg = count
      ? rows.reduce((sum: number, r: { overall: number | null }) => sum + (r.overall ?? 0), 0) /
        count
      : null;
    return { avg, count };
  };

  return {
    details: {
      authorId,
      firstName: profile?.first_name ?? pub?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      organization: profile?.organization_title ?? pub?.organization_title ?? null,
      photoUrl: profile?.profile_photo_url ?? pub?.profile_photo_url ?? null,
      city: profile?.location_city ?? null,
      stateAbbr: profile?.location_state_abbr ?? null,
      publishedCount: (poolRes.data ?? []).length,
      teams: ((teamsRes.data ?? []) as {
        slot: number;
        team_gender: string | null;
        age: string | null;
        competition_level: string | null;
      }[]).map((t) => ({
        slot: t.slot,
        gender: t.team_gender,
        age: t.age,
        level: t.competition_level,
      })),
      coachPool: pool(true),
      attendeePool: pool(false),
    },
  };
}
