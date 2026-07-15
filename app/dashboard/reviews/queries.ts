import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";
import type { ReviewCardRow } from "@/lib/reviews/queries";

/**
 * List reviews for the dashboard — either scoped to the ED's own
 * events (owner_id = self) or all reviews (admin). Search + filters
 * happen in-app after the fetch since the row count per ED is small
 * and the filter graph is complex (event id set + promo flag + state).
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

  const eventFilterIds: string[] | null =
    scope === "own"
      ? ((
          await supabase
            .from("events")
            .select("id")
            .eq("owner_id", userId)
        ).data ?? []).map((r: { id: string }) => r.id)
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

  const promoIds = Array.from(
    new Set(rows.map((r) => r.promo_id).filter((v): v is string => Boolean(v))),
  );
  const promoMap = new Map<string, string>();
  if (promoIds.length) {
    const { data: promos } = await supabase
      .from("promo_codes")
      .select("id, pretty_code")
      .in("id", promoIds);
    for (const p of (promos ?? []) as { id: string; pretty_code: string }[]) {
      promoMap.set(p.id, p.pretty_code);
    }
  }

  return rows.map(({ promo_id, ...rest }) => ({
    ...rest,
    promo_pretty_code: promo_id ? promoMap.get(promo_id) ?? null : null,
  }));
}
