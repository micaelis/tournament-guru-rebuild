import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";

/**
 * Review + comment reads for the public event page, dashboard tables,
 * and My Reviews. Every projection is narrow — reviews are RLS-gated,
 * but taking only what the UI needs keeps the wire small.
 */

export type ReviewCardRow = {
  id: string;
  event_id: string | null;
  author_id: string | null;
  status: "draft" | "published";
  rating_fields: number | null;
  rating_facilities: number | null;
  rating_management: number | null;
  rating_competition: number | null;
  rating_diversity: number | null;
  rating_cost_value: number | null;
  overall: number | null;
  review_title: string | null;
  review_body: string | null;
  would_return: boolean | null;
  guru_review: boolean;
  helpful_count: number;
  published_at: string | null;
  created_at: string;
  reviewer_role: string | null;
  anonymized: boolean;
  detached: boolean;
  snapshot_event_title: string | null;
  snapshot_event_start: string | null;
  snapshot_event_end: string | null;
  snapshot_event_location: string | null;
  snapshot_event_logo: string | null;
  author: {
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    profile_photo_url: string | null;
  } | null;
  promo_pretty_code: string | null;
};

export type CommentRow = {
  id: string;
  review_id: string;
  author_id: string | null;
  parent_comment_id: string | null;
  body: string;
  is_owner_reply: boolean;
  anonymized: boolean;
  created_at: string;
  updated_at: string;
  author: {
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    org_logo_url: string | null;
    profile_photo_url: string | null;
    user_type: "attendee" | "event_director" | "admin";
  } | null;
};

const REVIEW_BASE_COLUMNS =
  "id, event_id, author_id, status, rating_fields, rating_facilities, rating_management, rating_competition, rating_diversity, rating_cost_value, overall, review_title, review_body, would_return, guru_review, helpful_count, published_at, created_at, reviewer_role, anonymized, detached, snapshot_event_title, snapshot_event_start, snapshot_event_end, snapshot_event_location, snapshot_event_logo, promo_id, author:profiles!reviews_author_id_fkey(first_name, last_name, organization_title, profile_photo_url)";

/**
 * All PUBLISHED reviews for an event, ready to render on the public
 * page. Sorted newest-first. RLS + the p_reviews_read policy hides
 * user-hidden rows automatically; nothing extra needed here.
 */
export async function listReviewsForEvent(eventId: string): Promise<ReviewCardRow[]> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_BASE_COLUMNS)
    .eq("event_id", eventId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return await attachPromoCodes(
    (data ?? []) as unknown as (ReviewCardRow & { promo_id: string | null })[],
  );
}

/** Same as above but returns EVERY review including drafts (for the
 * dashboard and My Reviews surfaces). RLS ensures draft rows only
 * come back for their author or admin. */
export async function listReviewsRaw({
  authorId,
  eventIds,
  statusIn,
}: {
  authorId?: string;
  eventIds?: string[];
  statusIn?: ("draft" | "published")[];
}): Promise<ReviewCardRow[]> {
  const supabase = await createServerAuthClient();
  let q = supabase
    .from("reviews")
    .select(REVIEW_BASE_COLUMNS);
  if (authorId) q = q.eq("author_id", authorId);
  if (eventIds && eventIds.length) q = q.in("event_id", eventIds);
  if (statusIn && statusIn.length) q = q.in("status", statusIn);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return await attachPromoCodes(
    (data ?? []) as unknown as (ReviewCardRow & { promo_id: string | null })[],
  );
}

/**
 * The current user's review for an event (if any). Used by the
 * public event page to switch the "Write a review" CTA to "Edit your
 * review" and by the write-form to load defaults.
 */
export async function getMyReviewForEvent(
  userId: string,
  eventId: string,
): Promise<ReviewCardRow | null> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_BASE_COLUMNS)
    .eq("author_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const withPromo = await attachPromoCodes([
    data as unknown as ReviewCardRow & { promo_id: string | null },
  ]);
  return withPromo[0] ?? null;
}

/** All comments on a review, oldest-first. The tree builder in
 * shared code turns them into a flattened depth-first order for
 * rendering.
 */
export async function listCommentsForReview(reviewId: string): Promise<CommentRow[]> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, review_id, author_id, parent_comment_id, body, is_owner_reply, anonymized, created_at, updated_at, author:profiles!comments_author_id_fkey(first_name, last_name, organization_title, org_logo_url, profile_photo_url, user_type)",
    )
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CommentRow[];
}

/** Which reviews has the current user marked helpful? Used by the
 * ReviewCard client to render the toggle state without an extra
 * round-trip per card. */
export async function getUserHelpfulSet(
  userId: string,
  reviewIds: string[],
): Promise<Set<string>> {
  if (reviewIds.length === 0) return new Set();
  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("review_helpful")
    .select("review_id")
    .eq("user_id", userId)
    .in("review_id", reviewIds);
  return new Set(((data ?? []) as { review_id: string }[]).map((r) => r.review_id));
}

/**
 * Attach the 8-char pretty promo code to reviews that were published
 * against a promo. The chip on the card renders "Coach · A1B2C3D4"
 * only when promo_pretty_code is not null.
 */
async function attachPromoCodes(
  rows: (ReviewCardRow & { promo_id: string | null })[],
): Promise<ReviewCardRow[]> {
  const promoIds = Array.from(
    new Set(rows.map((r) => r.promo_id).filter((v): v is string => Boolean(v))),
  );
  if (promoIds.length === 0) {
    return rows.map(({ promo_id: _promoId, ...rest }) => ({
      ...rest,
      promo_pretty_code: null,
    }));
  }
  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("promo_codes")
    .select("id, pretty_code")
    .in("id", promoIds);
  const map = new Map(
    ((data ?? []) as { id: string; pretty_code: string }[]).map((r) => [
      r.id,
      r.pretty_code,
    ]),
  );
  return rows.map(({ promo_id, ...rest }) => ({
    ...rest,
    promo_pretty_code: promo_id ? map.get(promo_id) ?? null : null,
  }));
}
