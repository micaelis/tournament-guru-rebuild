import Link from "next/link";
import type { Route } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";
import {
  Button,
  Card,
  EmptyState,
  StarRating,
} from "@/app/components/ui";
import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "@/app/components/ui/SafeImg";
import { FavoriteButton } from "@/app/components/reviews/FavoriteButton";

/**
 * Attendee favorites — event cards with Unfollow + Visit CTAs.
 * Ordered by newest fav.
 */
export default async function FavoritesPage() {
  const { user } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();
  // unwrap: a failed query must not render as "no favorites yet".
  const rows = unwrapRows(
    await supabase
      .from("favorites")
      .select(
        "event_id, created_at, event:events!favorites_event_id_fkey(id, title, host_club, location_formatted, start_date, end_date, logo_url, general_rating, review_count)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    "FavoritesPage favorites",
  ) as unknown as {
    event_id: string;
    created_at: string;
    event: {
      id: string;
      title: string;
      host_club: string | null;
      location_formatted: string | null;
      start_date: string | null;
      end_date: string | null;
      logo_url: string | null;
      general_rating: number | null;
      review_count: number;
    } | null;
  }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          Favorites
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Events you&apos;ve saved, all in one place — so they&apos;re easy to
          find when it&apos;s time to plan.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          body="Hit the heart on any event to save it here."
          action={
            <Link href={"/events" as Route}>
              <Button>Browse events</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.event_id} className="p-4">
              {r.event ? (
                <div className="flex flex-wrap items-center gap-4">
                  <EventLogo url={r.event.logo_url} title={r.event.title} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/events/${r.event.id}` as Route}
                      className="text-[15px] font-bold text-slate-900 hover:text-red-600"
                    >
                      {r.event.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {r.event.host_club && <>{r.event.host_club} · </>}
                      {r.event.location_formatted ?? "—"}
                      {" · "}
                      {formatRange(r.event.start_date, r.event.end_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.event.review_count > 0 && (
                      <StarRating
                        value={r.event.general_rating ?? 0}
                        count={r.event.review_count}
                        size={12}
                      />
                    )}
                    <FavoriteButton
                      eventId={r.event.id}
                      initialFavorited={true}
                    />
                    <Link href={`/events/${r.event.id}` as Route}>
                      <Button size="sm">Visit</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Event removed.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EventLogo({
  url,
  title,
}: {
  url: string | null;
  title: string;
}) {
  const safe = safeImageSrc(url);
  return (
    <span className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-xl bg-slate-100">
      <SafeImg
        src={safe ?? undefined}
        alt=""
        className="h-full w-full object-cover"
        fallback={
          <span className="text-lg font-extrabold text-slate-500">
            {title[0]?.toUpperCase() ?? "T"}
          </span>
        }
      />
    </span>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Dates TBD";
  if (start && end && start === end) return short(start);
  return [start ? short(start) : "?", end ? short(end) : "?"].join(" – ");
}
function short(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
