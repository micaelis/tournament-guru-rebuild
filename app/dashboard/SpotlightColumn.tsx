import Link from "next/link";
import type { Route } from "next";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRowsLogged } from "@/lib/supabase/unwrap";
import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "@/app/components/ui/SafeImg";
import { FavoriteButton } from "@/app/components/reviews/FavoriteButton";

type SpotlightEvent = {
  id: string;
  title: string;
  logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  location_city: string | null;
  location_state_abbr: string | null;
};

async function fetchSpotlightEvents(
  userId: string | null,
): Promise<{ events: SpotlightEvent[]; favoritedIds: Set<string> }> {
  const supabase = await createServerAuthClient();
  const cutoff = new Date(Date.now() - 25 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  // Ads chrome: degrade (logged) rather than take the dashboard down.
  const events = unwrapRowsLogged<SpotlightEvent>(
    await supabase
      .from("events")
      .select(
        "id, title, logo_url, start_date, end_date, location_city, location_state_abbr",
      )
      .eq("is_general_ad", true)
      .not("lifecycle", "in", "(draft,canceled)")
      .gte("end_date", cutoff)
      .order("start_date", { ascending: true })
      .limit(10),
    "fetchSpotlightEvents events",
  );

  let favoritedIds = new Set<string>();
  if (userId && events.length > 0) {
    const favs = unwrapRowsLogged<{ event_id: string }>(
      await supabase
        .from("favorites")
        .select("event_id")
        .eq("user_id", userId)
        .in(
          "event_id",
          events.map((e) => e.id),
        ),
      "fetchSpotlightEvents favorites",
    );
    favoritedIds = new Set(favs.map((f) => f.event_id));
  }

  return { events, favoritedIds };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start);
  const e = new Date(end ?? "");
  if (isNaN(s.getTime())) return start;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start === end || isNaN(e.getTime())) return fmt(s);
  return `${fmt(s)} – ${fmt(e)}`;
}

export async function SpotlightColumn({ userId }: { userId?: string | null }) {
  const { events: all, favoritedIds } = await fetchSpotlightEvents(
    userId ?? null,
  );
  if (all.length === 0) return null;

  const events = shuffle(all).slice(0, 3);

  return (
    <aside
      className="sticky top-8 hidden w-[270px] shrink-0 lg:block"
      aria-label="Spotlight events"
    >
      <h2
        className="font-[var(--font-heading)] text-[13px] font-extrabold uppercase tracking-wider"
        style={{ color: "var(--color-text-secondary)", letterSpacing: ".08em" }}
      >
        Spotlight
      </h2>
      <p
        className="mt-1 text-[12px] leading-snug"
        style={{ color: "var(--color-text-muted)" }}
      >
        Check out these events
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {events.map((ev) => {
          const location = [ev.location_city, ev.location_state_abbr]
            .filter(Boolean)
            .join(", ");
          return (
            <div
              key={ev.id}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="absolute right-2 top-2 z-10">
                <FavoriteButton
                  variant="icon"
                  eventId={ev.id}
                  initialFavorited={favoritedIds.has(ev.id)}
                  disabled={!userId}
                />
              </div>
              <Link href={`/events/${ev.id}` as Route} className="block">
                {ev.logo_url && (
                  <div className="relative h-[100px] w-full overflow-hidden bg-slate-100">
                    <SafeImg
                      src={safeImageSrc(ev.logo_url) ?? undefined}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-3">
                  <h3
                    className="line-clamp-2 text-[13px] font-bold leading-snug"
                    style={{ color: "var(--color-dark)" }}
                  >
                    {ev.title}
                  </h3>
                  <p
                    className="mt-1 text-[11px] font-medium"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {formatDateRange(ev.start_date, ev.end_date)}
                  </p>
                  {location && (
                    <p
                      className="mt-0.5 truncate text-[11px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {location}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
