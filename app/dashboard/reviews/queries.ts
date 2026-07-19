import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";
import type { ReviewCardRow } from "@/lib/reviews/queries";

/**
 * List reviews for the dashboard — either scoped to the ED's own
 * events (owner_id = self) or all reviews (admin). Search + filters
 * happen in-app after the fetch since the row count per ED is small
 * and the filter graph is complex (event id set + promo flag + state).
 *
 * Reviewer identity depth follows RLS, same as the reviewer popup:
 * the profiles join resolves for admins (full name) and comes back
 * null for EDs, whose rows are then backfilled from the public
 * review_author_public view (first name, org, photo — never
 * last_name). No grant is widened; the two roles see different
 * depths, and name search runs over whatever depth the caller got.
 */
export async function listDashboardReviews({
  userId,
  scope,
}: {
  userId: string;
  scope: "own" | "all";
}): Promise<
  Array<
    ReviewCardRow & {
      event: {
        id: string;
        title: string;
        location_state_abbr: string | null;
      } | null;
    }
  >
> {
  const supabase = await createServerAuthClient();

  // unwrap: the H-0 shape — an error here would collapse into an empty
  // id set → ZERO_UUID filter → the ED "has no reviews".
  const eventFilterIds: string[] | null =
    scope === "own"
      ? unwrapRows<{ id: string }>(
          await supabase.from("events").select("id").eq("owner_id", userId),
          "listDashboardReviews owned events",
        ).map((r) => r.id)
      : null;

  const base = supabase
    .from("reviews")
    .select(
      "id, event_id, author_id, status, rating_fields, rating_facilities, rating_management, rating_competition, rating_diversity, rating_cost_value, overall, review_title, review_body, would_return, guru_review, helpful_count, published_at, created_at, reviewer_role, anonymized, detached, snapshot_event_title, snapshot_event_start, snapshot_event_end, snapshot_event_location, snapshot_event_logo, promo_id, event:events!reviews_event_id_fkey(id, title, location_state_abbr), author:profiles!reviews_author_id_fkey(first_name, last_name, organization_title, profile_photo_url)",
    );
  const scoped = eventFilterIds
    ? eventFilterIds.length
      ? base.in("event_id", eventFilterIds)
      : base.eq("event_id", "00000000-0000-0000-0000-000000000000")
    : base;

  const { data, error } = await scoped.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<
    ReviewCardRow & {
      promo_id: string | null;
      event: { id: string; title: string; location_state_abbr: string | null } | null;
    }
  >;

  // ED path: profiles is RLS-filtered, so the join above returned
  // author = null. Backfill those rows from review_author_public.
  const missingAuthorIds = rows
    .filter((r) => !r.author && !r.anonymized && r.author_id)
    .map((r) => r.id);
  if (missingAuthorIds.length) {
    const publicAuthors = unwrapRows<{
      review_id: string;
      first_name: string | null;
      organization_title: string | null;
      profile_photo_url: string | null;
    }>(
      await supabase
        .from("review_author_public")
        .select("review_id, first_name, organization_title, profile_photo_url")
        .in("review_id", missingAuthorIds),
      "dashboard reviews public authors",
    );
    const authorMap = new Map(publicAuthors.map((a) => [a.review_id, a]));
    for (const row of rows) {
      if (row.author || row.anonymized || !row.author_id) continue;
      const pub = authorMap.get(row.id);
      if (!pub) continue;
      row.author = {
        first_name: pub.first_name,
        last_name: null,
        organization_title: pub.organization_title,
        profile_photo_url: pub.profile_photo_url,
      };
    }
  }

  const promoIds = Array.from(
    new Set(rows.map((r) => r.promo_id).filter((v): v is string => Boolean(v))),
  );
  const promoMap = new Map<string, string>();
  if (promoIds.length) {
    const promos = unwrapRows<{ id: string; pretty_code: string }>(
      await supabase.from("promo_codes").select("id, pretty_code").in("id", promoIds),
      "dashboard reviews promo codes",
    );
    for (const p of promos) {
      promoMap.set(p.id, p.pretty_code);
    }
  }

  return rows.map(({ promo_id, ...rest }) => ({
    ...rest,
    promo_pretty_code: promo_id ? promoMap.get(promo_id) ?? null : null,
  }));
}
