import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";
import { fetchInChunks } from "@/lib/supabase/in-chunks";
import { unwrapRows } from "@/lib/supabase/unwrap";

/**
 * Review + comment reads for the public event page, dashboard tables,
 * and My Reviews. Every projection is narrow — reviews are RLS-gated,
 * but taking only what the UI needs keeps the wire small.
 *
 * Public paths (event page reviews list + comments) route reviewer
 * and comment-author identity through the review_author_public /
 * public_comment_authors SECURITY DEFINER views so anon callers see
 * the display fields RLS would otherwise blank out. Neither view
 * exposes last_name, email, or DOB.
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

/**
 * Base column set for a review row. Deliberately excludes the
 * profiles join — public paths attach identity through the
 * review_author_public view (see attachPublicAuthors); dashboard
 * paths add their own joined author later.
 */
const REVIEW_BASE_COLUMNS =
  "id, event_id, author_id, status, rating_fields, rating_facilities, rating_management, rating_competition, rating_diversity, rating_cost_value, overall, review_title, review_body, would_return, guru_review, helpful_count, published_at, created_at, reviewer_role, anonymized, detached, snapshot_event_title, snapshot_event_start, snapshot_event_end, snapshot_event_location, snapshot_event_logo, promo_id";

/**
 * All PUBLISHED reviews for an event, ready to render on the public
 * page. Sorted newest-first. RLS + the p_reviews_read policy hides
 * user-hidden rows automatically. Reviewer identity comes from
 * review_author_public — safe for anon callers.
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
  return attachPublicAuthors(
    await attachPromoCodes(
      (data ?? []) as unknown as (Omit<ReviewCardRow, "author" | "promo_pretty_code"> & {
        promo_id: string | null;
      })[],
    ),
  );
}

/**
 * All PUBLISHED reviews across a set of events, newest-first — the
 * public ED page's Reviews tab (every event this director owns).
 * Same identity guarantee as listReviewsForEvent: authors attach via
 * review_author_public, never the profiles table.
 */
export async function listReviewsForEvents(
  eventIds: string[],
  limit = 50,
): Promise<ReviewCardRow[]> {
  if (eventIds.length === 0) return [];
  const supabase = await createServerAuthClient();
  // A director's event list is unbounded — batch the .in(), then merge
  // the per-batch newest-first pages back into one and re-cut the limit.
  type Raw = Omit<ReviewCardRow, "author" | "promo_pretty_code"> & {
    promo_id: string | null;
  };
  const merged = (await fetchInChunks(eventIds, async (chunk) => {
    const { data, error } = await supabase
      .from("reviews")
      .select(REVIEW_BASE_COLUMNS)
      .in("event_id", chunk)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw new Error(`listReviewsForEvents reviews: ${error.message}`);
    return (data ?? []) as unknown as Raw[];
  })) as Raw[];
  merged.sort((a, b) => {
    const av = a.published_at ?? "";
    const bv = b.published_at ?? "";
    if (av === bv) return 0;
    if (av === "") return 1;
    if (bv === "") return -1;
    return av < bv ? 1 : -1;
  });
  return attachPublicAuthors(await attachPromoCodes(merged.slice(0, limit)));
}

/**
 * All PUBLISHED reviews by one author, newest-first — the public
 * attendee page. RLS keeps hidden rows out for anon; identity attaches
 * via review_author_public like every public path.
 */
export async function listReviewsForAuthor(
  authorId: string,
  limit = 50,
): Promise<ReviewCardRow[]> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_BASE_COLUMNS)
    .eq("author_id", authorId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`listReviewsForAuthor reviews: ${error.message}`);
  return attachPublicAuthors(
    await attachPromoCodes(
      (data ?? []) as unknown as (Omit<ReviewCardRow, "author" | "promo_pretty_code"> & {
        promo_id: string | null;
      })[],
    ),
  );
}

/**
 * Dashboard / My Reviews path — draft-visible for the author + admin
 * per RLS. Uses the profiles-join projection so the ED / Admin table
 * can render full profile info via RLS (admin bypass) when it applies.
 * Public reads don't come through this path.
 */
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
    .select(
      REVIEW_BASE_COLUMNS +
        ", author:profiles!reviews_author_id_fkey(first_name, last_name, organization_title, profile_photo_url)",
    );
  if (authorId) q = q.eq("author_id", authorId);
  if (eventIds && eventIds.length) q = q.in("event_id", eventIds);
  if (statusIn && statusIn.length) q = q.in("status", statusIn);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachPromoCodes(
    (data ?? []) as unknown as (Omit<ReviewCardRow, "promo_pretty_code"> & {
      promo_id: string | null;
    })[],
  );
}

/**
 * The current user's review for an event (if any). Used by the
 * public event page to switch the "Write a review" CTA to "Edit your
 * review" and by the write-form to load defaults. The caller IS the
 * author, so the joined projection stays narrow — the write form
 * doesn't render last_name.
 */
export async function getMyReviewForEvent(
  userId: string,
  eventId: string,
): Promise<ReviewCardRow | null> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      REVIEW_BASE_COLUMNS +
        ", author:profiles!reviews_author_id_fkey(first_name, organization_title, profile_photo_url)",
    )
    .eq("author_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const withPromo = await attachPromoCodes([
    data as unknown as Omit<ReviewCardRow, "promo_pretty_code"> & {
      promo_id: string | null;
    },
  ]);
  return withPromo[0] ?? null;
}

/**
 * All comments on a review, oldest-first. Public path — author
 * identity comes from public_comment_authors so anon + non-owner
 * callers see the display fields the RLS-protected profiles row
 * would otherwise blank out.
 */
export async function listCommentsForReview(reviewId: string): Promise<CommentRow[]> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, review_id, author_id, parent_comment_id, body, is_owner_reply, anonymized, created_at, updated_at",
    )
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const raw = (data ?? []) as unknown as Omit<CommentRow, "author">[];
  return attachPublicCommentAuthors(raw);
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
  const rows = unwrapRows<{ review_id: string }>(
    await supabase
      .from("review_helpful")
      .select("review_id")
      .eq("user_id", userId)
      .in("review_id", reviewIds),
    "getUserHelpfulSet",
  );
  return new Set(rows.map((r) => r.review_id));
}

/**
 * Attach reviewer identity via the SECURITY DEFINER
 * review_author_public view. Anon reads see first_name + org +
 * photo + role + guru; never last_name / email / dob.
 */
async function attachPublicAuthors(
  rows: (Omit<ReviewCardRow, "author"> & { review_id?: string })[],
): Promise<ReviewCardRow[]> {
  if (rows.length === 0) return rows as unknown as ReviewCardRow[];
  const supabase = await createServerAuthClient();
  const ids = rows.map((r) => r.id);
  // View columns generate as nullable (views drop NOT NULL), so the
  // review_id key narrows via the loop guard.
  const authorRows = unwrapRows(
    await supabase
      .from("review_author_public")
      .select(
        "review_id, first_name, last_initial, organization_title, profile_photo_url",
      )
      .in("review_id", ids),
    "attachPublicAuthors",
  );
  const map = new Map<
    string,
    {
      first_name: string | null;
      last_initial: string | null;
      organization_title: string | null;
      profile_photo_url: string | null;
    }
  >();
  for (const row of authorRows) {
    if (!row.review_id) continue;
    map.set(row.review_id, {
      first_name: row.first_name,
      last_initial: row.last_initial,
      organization_title: row.organization_title,
      profile_photo_url: row.profile_photo_url,
    });
  }
  return rows.map((r) => ({
    ...r,
    author: (() => {
      const public_row = map.get(r.id);
      if (!public_row) return null;
      return {
        first_name: public_row.first_name,
        // Public name rule: first name + last INITIAL ("Ashley M.") —
        // the view never carries the last name itself.
        last_name: public_row.last_initial ? `${public_row.last_initial}.` : null,
        organization_title: public_row.organization_title,
        profile_photo_url: public_row.profile_photo_url,
      };
    })(),
  })) as unknown as ReviewCardRow[];
}

/** Same idea for comments via public_comment_authors. */
async function attachPublicCommentAuthors(
  rows: Omit<CommentRow, "author">[],
): Promise<CommentRow[]> {
  if (rows.length === 0) return rows as unknown as CommentRow[];
  const supabase = await createServerAuthClient();
  const ids = rows.map((r) => r.id);
  const authorRows = unwrapRows(
    await supabase
      .from("public_comment_authors")
      .select(
        "comment_id, first_name, last_initial, organization_title, org_logo_url, profile_photo_url, user_type",
      )
      .in("comment_id", ids),
    "attachPublicCommentAuthors",
  );
  const map = new Map<
    string,
    {
      first_name: string | null;
      last_initial: string | null;
      organization_title: string | null;
      org_logo_url: string | null;
      profile_photo_url: string | null;
      user_type: string | null;
    }
  >();
  for (const row of authorRows) {
    if (!row.comment_id) continue;
    map.set(row.comment_id, {
      first_name: row.first_name,
      last_initial: row.last_initial,
      organization_title: row.organization_title,
      org_logo_url: row.org_logo_url,
      profile_photo_url: row.profile_photo_url,
      user_type: row.user_type,
    });
  }
  return rows.map((r) => {
    const p = map.get(r.id);
    return {
      ...r,
      author: p
        ? {
            first_name: p.first_name,
            // Public name rule: first name + last INITIAL ("Ashley M.").
            last_name: p.last_initial ? `${p.last_initial}.` : null,
            organization_title: p.organization_title,
            org_logo_url: p.org_logo_url,
            profile_photo_url: p.profile_photo_url,
            user_type: (p.user_type ?? "attendee") as
              | "attendee"
              | "event_director"
              | "admin",
          }
        : null,
    };
  }) as CommentRow[];
}

/**
 * Attach the 8-char pretty promo code to reviews that were published
 * against a promo. The chip on the card renders "Coach · A1B2C3D4"
 * only when promo_pretty_code is not null.
 */
async function attachPromoCodes<
  R extends { promo_id: string | null; id: string },
>(rows: R[]): Promise<(R & { promo_pretty_code: string | null })[]> {
  const promoIds = Array.from(
    new Set(rows.map((r) => r.promo_id).filter((v): v is string => Boolean(v))),
  );
  if (promoIds.length === 0) {
    return rows.map((r) => ({ ...r, promo_pretty_code: null }));
  }
  const supabase = await createServerAuthClient();
  const promoRows = unwrapRows<{ id: string; pretty_code: string }>(
    await supabase.from("promo_codes").select("id, pretty_code").in("id", promoIds),
    "attachPromoCodes",
  );
  const map = new Map(promoRows.map((r) => [r.id, r.pretty_code]));
  return rows.map((r) => ({
    ...r,
    promo_pretty_code: r.promo_id ? map.get(r.promo_id) ?? null : null,
  }));
}
