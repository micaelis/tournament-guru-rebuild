"use client";

/* PromoStrips — the prototype's "Recommended for you" + "Promoted" surfaces,
   restyled strictly to the brand palette (red / slate / white) and wired to
   REAL events: recommended = highest-rated public events, promoted = premium
   (paid) events. Both link into the real event pages. */

import { useRef, useState } from "react";
import Link from "next/link";
import { LogoPanel, RatingBadge, IconPin, fmtDateRange } from "@/app/components/card-bits";
import type { EventRow } from "@/lib/supabase/queries";

function loc(e: EventRow) {
  return e.location_text || e.state || "";
}
function ageIdx(v: string): number {
  const m = /^u(\d+)$/i.exec(v);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}
function ageRange(e: EventRow) {
  const ages = (e.event_ages ?? [])
    .map((a) => a.age.toUpperCase())
    .sort((a, b) => ageIdx(a) - ageIdx(b));
  if (!ages.length) return null;
  return ages.length > 1 ? `${ages[0]}–${ages[ages.length - 1]}` : ages[0];
}

/* ── Recommended for you ─────────────────────────────────────── */
export function RecommendedStrip({ events }: { events: EventRow[] }) {
  if (events.length === 0) return null;
  const items = events.slice(0, 4);
  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: "var(--color-border)", boxShadow: "0 8px 24px -18px rgba(15,23,42,.4)" }}
      aria-label="Recommended for you"
    >
      <div
        className="flex items-center gap-3 border-b px-[18px] py-3.5"
        style={{
          borderColor: "var(--color-border-light)",
          background: "linear-gradient(180deg, var(--color-surface) 0%, #fff 100%)",
        }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white"
          style={{
            background: "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
            boxShadow: "0 6px 14px -3px rgba(220,38,38,.5)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M13 2L3 14h7v8l10-12h-7V2z" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="font-heading text-[18px] font-extrabold leading-tight" style={{ color: "var(--color-dark)", letterSpacing: "-0.01em" }}>
            Recommended for you
          </div>
          <div className="truncate text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            Top-rated events, matched to your search
          </div>
        </div>
      </div>
      <div className="grid gap-2.5 p-3.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
        {items.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="group overflow-hidden rounded-xl border bg-white no-underline transition-transform hover:-translate-y-0.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <LogoPanel logo={e.logo} title={e.title} style={{ height: 104 }} />
            <div className="p-2.5">
              <div
                className="text-[11px] font-bold uppercase"
                style={{ color: "var(--color-accent)", letterSpacing: ".04em", fontFamily: "var(--font-mono)" }}
              >
                {fmtDateRange(e.start_date, e.end_date)}
              </div>
              <div
                className="font-heading mt-1 truncate text-[13px] font-bold"
                style={{ color: "var(--color-dark)", letterSpacing: "-0.01em" }}
              >
                {e.title}
              </div>
              <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {loc(e)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Promoted (paid) events ──────────────────────────────────── */
export function PromotedStrip({ events }: { events: EventRow[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || events.length === 0) return null;

  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <section
      className="my-4 rounded-2xl border p-[18px]"
      style={{ borderColor: "var(--color-border)", background: "linear-gradient(180deg, var(--color-surface) 0%, #fff 100%)" }}
      aria-label="Promoted events"
    >
      <div className="mb-3.5 flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-[5px] text-[11px] font-extrabold uppercase text-white"
            style={{ background: "var(--color-accent)", letterSpacing: ".06em" }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5l8 14H4z" /></svg>
            Promoted
          </span>
          <span className="truncate text-[13.5px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            Sponsored picks for your search
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ScrollBtn dir={-1} onClick={() => scrollBy(-1)} />
          <ScrollBtn dir={1} onClick={() => scrollBy(1)} />
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss promoted events"
            className="tg-hover ml-1 flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-faint)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>
      <div ref={scroller} className="flex gap-3.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="shrink-0 overflow-hidden rounded-xl border bg-white no-underline"
            style={{ width: 288, borderColor: "var(--color-border)" }}
          >
            <div className="relative">
              <LogoPanel logo={e.logo} title={e.title} style={{ height: 150 }} />
              <span
                className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-[10px] font-extrabold uppercase"
                style={{ borderColor: "var(--color-border)", color: "var(--color-dark)", letterSpacing: ".05em" }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--color-accent)" aria-hidden="true"><path d="M12 5l8 14H4z" /></svg>
                Promoted
              </span>
            </div>
            <div className="p-3.5">
              <div className="font-heading truncate text-[15px] font-bold" style={{ color: "var(--color-dark)", letterSpacing: "-0.01em" }}>
                {e.title}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                <IconPin /> {loc(e)}
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {[fmtDateRange(e.start_date, e.end_date), ageRange(e)].filter(Boolean).join(" · ")}
                </span>
                {e.general_rating != null && e.general_rating > 0 && (
                  <RatingBadge rating={Number(e.general_rating)} count={e.reviews ?? 0} />
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ScrollBtn({ dir, onClick }: { dir: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir < 0 ? "Scroll left" : "Scroll right"}
      className="tg-hover flex h-8 w-9 items-center justify-center rounded-lg border bg-white"
      style={{ borderColor: "var(--color-border)", color: "var(--color-dark)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dir < 0 ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}
