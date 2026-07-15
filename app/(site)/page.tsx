import Link from "next/link";
import type { Route } from "next";
import {
  Avatar,
  Button,
  Card,
  StarRating,
  StatusPill,
} from "@/app/components/ui";
import { safeImageSrc } from "@/lib/url";
import {
  fetchDemoReviews,
  fetchFeaturedEvents,
  fetchPlatformStats,
  fetchPopularSearches,
} from "./queries";

/**
 * Public landing page. Hero + Featured Events strip + platform stats +
 * popular search chips + demo_reviews testimonials. Every data pull
 * uses the anon server client and falls back cleanly when the DB is
 * empty (fresh install).
 */
export default async function Landing() {
  const [stats, featured, popular, demo] = await Promise.all([
    fetchPlatformStats(),
    fetchFeaturedEvents(),
    fetchPopularSearches(),
    fetchDemoReviews(),
  ]);
  return (
    <>
      <Hero popular={popular} />
      <FeaturedStrip events={featured} />
      <StatsBand stats={stats} />
      <TestimonialsBand rows={demo} />
      <SiteFooter />
    </>
  );
}

function Hero({
  popular,
}: {
  popular: { term: string; hits: number }[];
}) {
  return (
    <section className="tg-aurora">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600">
          The most comprehensive youth sports tournament search engine
        </p>
        <h1 className="mt-4 font-[var(--font-heading)] text-5xl font-extrabold text-slate-900 md:text-6xl">
          Find the right event for <span className="text-red-600">your team</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Event information and verified reviews from previous attendees, to
          help families, coaches, and managers pick their team&apos;s next
          event.
        </p>
        <div className="mx-auto mt-8 flex max-w-xl items-center gap-2">
          <form action={"/events" as Route} className="flex w-full items-center gap-2">
            <input
              name="q"
              placeholder="City, state, or tournament name"
              className="tg-control flex-1"
            />
            <Button type="submit" size="lg">
              Search events
            </Button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600">
          <span className="font-semibold">Popular:</span>
          {popular.map((p) => (
            <Link
              key={p.term}
              href={`/events?q=${encodeURIComponent(p.term)}` as Route}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:border-slate-400"
            >
              {p.term}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedStrip({
  events,
}: {
  events: Awaited<ReturnType<typeof fetchFeaturedEvents>>;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
            Featured Events
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Premium + sponsored events happening soon.
          </p>
        </div>
        <Link
          href={"/events" as Route}
          className="text-sm font-semibold text-red-600 underline"
        >
          Browse all events →
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No featured events yet — check back soon.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <FeaturedCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturedCard({
  event,
}: {
  event: Awaited<ReturnType<typeof fetchFeaturedEvents>>[number];
}) {
  const logo = safeImageSrc(event.logo_url);
  return (
    <Link
      href={`/events/${event.id}` as Route}
      className="block rounded-2xl border border-red-200 bg-white p-5 transition hover:border-red-400"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-100 to-red-100">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg font-extrabold text-red-600">
              {event.title[0]?.toUpperCase() ?? "T"}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            {event.is_premium && <StatusPill tone="warning">Premium</StatusPill>}
            {event.is_sponsored && <StatusPill tone="info">Sponsored</StatusPill>}
          </div>
          <h3 className="mt-2 text-lg font-extrabold text-slate-900">
            {event.title}
          </h3>
          <p className="text-xs text-slate-500">
            {event.host_club && <>{event.host_club} · </>}
            {event.location_formatted ?? "Location TBD"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {formatRangeShort(event.start_date, event.end_date)}
        </span>
        {event.review_count > 0 && (
          <StarRating
            value={event.general_rating ?? 0}
            count={event.review_count}
            size={12}
          />
        )}
      </div>
      {event.would_return_pct !== null && (
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-amber-800">
          {event.would_return_pct.toFixed(0)}% would return
        </p>
      )}
    </Link>
  );
}

function StatsBand({ stats }: { stats: Awaited<ReturnType<typeof fetchPlatformStats>> }) {
  return (
    <section className="bg-slate-900 py-16 text-white">
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 text-center md:grid-cols-3">
        <div>
          <p className="font-[var(--font-heading)] text-5xl font-extrabold text-red-400">
            {stats.tournaments.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-slate-300">tournaments listed</p>
        </div>
        <div>
          <p className="font-[var(--font-heading)] text-5xl font-extrabold text-red-400">
            {stats.events.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-slate-300">events on the platform</p>
        </div>
        <div>
          <p className="font-[var(--font-heading)] text-5xl font-extrabold text-red-400">
            {stats.reviews.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-slate-300">reviews published</p>
        </div>
      </div>
    </section>
  );
}

function TestimonialsBand({
  rows,
}: {
  rows: Awaited<ReturnType<typeof fetchDemoReviews>>;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
        Recent Reviews
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        A sample of what attendees have shared with us.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-center gap-2">
              <Avatar name={r.reviewer_name} size={36} />
              <div>
                <p className="text-sm font-bold text-slate-900">{r.reviewer_name}</p>
                <p className="text-[11px] text-slate-500">
                  {r.reviewer_role ?? "Reviewer"}
                </p>
              </div>
            </div>
            {r.overall !== null && (
              <div className="mt-3">
                <StarRating value={r.overall} size={12} showNumber />
              </div>
            )}
            {r.review_title && (
              <h3 className="mt-3 text-[15px] font-extrabold text-slate-900">
                {r.review_title}
              </h3>
            )}
            {r.review_body && (
              <p className="mt-1 line-clamp-4 text-sm text-slate-700">
                {r.review_body}
              </p>
            )}
            {r.event_title && (
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {r.event_title}
              </p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10 text-center text-xs text-slate-500">
      <p>© {new Date().getFullYear()} Tournament Guru — all rights reserved.</p>
      <p className="mt-2 flex flex-wrap justify-center gap-4">
        <Link href={"/events" as Route}>Search Events</Link>
        <Link href={"/directors" as Route}>Directors</Link>
        <Link href={"/login" as Route}>Sign in</Link>
      </p>
    </footer>
  );
}

function formatRangeShort(start: string | null, end: string | null): string {
  if (!start && !end) return "Dates TBD";
  if (start && end && start === end) return short(start);
  return [start ? short(start) : "?", end ? short(end) : "?"].join(" – ");
}
function short(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
