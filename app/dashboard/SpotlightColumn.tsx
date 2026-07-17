import Link from "next/link";
import type { Route } from "next";
import { createAnonServerClient } from "@/lib/supabase/server";
import { safeImageSrc } from "@/lib/url";

type SpotlightEvent = {
  id: string;
  title: string;
  logo_url: string | null;
  start_date: string | null;
  location_formatted: string | null;
};

async function fetchSpotlightEvents(): Promise<SpotlightEvent[]> {
  const supabase = createAnonServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, logo_url, start_date, location_formatted")
    .eq("lifecycle", "active")
    .eq("is_general_ad", true)
    .gte("start_date", new Date().toISOString().slice(0, 10))
    .order("start_date", { ascending: true })
    .limit(10);
  return (data ?? []) as SpotlightEvent[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export async function SpotlightColumn() {
  const all = await fetchSpotlightEvents();
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
        {events.map((ev) => (
          <Link
            key={ev.id}
            href={`/events/${ev.id}` as Route}
            className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
          >
            {ev.logo_url && (
              <div className="relative h-[100px] w-full overflow-hidden bg-slate-100">
                <img
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
              {ev.start_date && (
                <p
                  className="mt-1 text-[11px] font-medium"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {formatDate(ev.start_date)}
                </p>
              )}
              {ev.location_formatted && (
                <p
                  className="mt-0.5 text-[11px] truncate"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {ev.location_formatted}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
