import Link from "next/link";
import type { Route } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { EmptyState, Button } from "@/app/components/ui";
import { listDashboardReviews } from "./queries";
import { ReviewsTable } from "./ReviewsTable";
import { AttendeeReviews } from "./AttendeeReviews";
import { listReviewsRaw } from "@/lib/reviews/queries";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Reviews dashboard. Split by role:
 * - Attendee → "My Reviews" list with edit-in-window nudge + state
 *   filter + sort (Newest/Oldest/Best/Worst).
 * - ED / Admin → sortable + searchable table of reviews on events
 *   they own (ED) or every event (Admin), with bulk CSV + owner
 *   reply + admin edit/delete.
 */
export default async function ReviewsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, user } = await requireSessionAndProfile();
  const sp = await searchParams;

  if (profile.user_type === "attendee") {
    const rows = await listReviewsRaw({ authorId: user.id });
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
            My Reviews
          </h1>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-bold text-slate-600">
            {rows.length}
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="You haven't written any reviews yet"
            body="Attend an event, then come back to share what you thought."
            action={
              <Link href={"/events" as Route}>
                <Button>Find events</Button>
              </Link>
            }
          />
        ) : (
          <AttendeeReviews rows={rows} />
        )}
      </div>
    );
  }

  const scope: "own" | "all" = profile.user_type === "admin" ? "all" : "own";
  const rows = await listDashboardReviews({ userId: user.id, scope });
  const search = typeof sp.q === "string" ? sp.q : "";
  const promoFilter = typeof sp.promo === "string" ? sp.promo : "";
  const stateFilter = typeof sp.state === "string" ? sp.state : "";

  const availableStates = Array.from(
    new Set(
      rows
        .map((r) => r.event?.location_state_abbr)
        .filter((v): v is string => Boolean(v)),
    ),
  ).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Reviews
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {profile.user_type === "admin"
            ? "Every published + drafted review on the platform."
            : "Reviews on events you own."}
        </p>
      </div>
      <ReviewsTable
        rows={rows}
        currentUserId={user.id}
        isAdmin={profile.user_type === "admin"}
        availableStates={availableStates}
        initialSearch={search}
        initialPromoFilter={promoFilter}
        initialStateFilter={stateFilter}
      />
    </div>
  );
}
