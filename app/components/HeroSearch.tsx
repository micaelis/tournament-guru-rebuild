"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

/* Real platform stats — the same source (getStats) the "Who We Are & What We
   Do" band renders, so the hero's trust numbers match that section exactly. */
type HeroStats = {
  eventsCount: number;
  reviewsCount: number;
  tournamentsCount: number;
};

/* Curated fallback chips, used when there aren't enough logged searches yet to
   compute real "most popular" ones (see getPopularSearches / search_queries). */
const QUICK_SEARCHES = ["U14 Boys", "St. Louis, MO", "This summer"];

const ICON_STAR = (
  <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
);
const ICON_TROPHY = (
  <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M6 4h12v5a6 6 0 01-12 0V4zM12 15v4M8 21h8" />
);
const ICON_CALENDAR = (
  <>
    <rect x="3" y="4" width="18" height="17" rx="2.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </>
);

const HERO_CSS = `
@property --hero-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
/* Popular chips — layered hover:
   1) a lift + white background so the whole chip pops off the header photo
   2) a soft red halo shadow underneath (brand-tinted, not neutral gray)
   3) a red "string" tracing around the border via a conic-gradient ring
      whose angle animates. The lift + halo make the chip *obviously*
      interactive even before the trace runs; the trace is the polish. */
.hero-pop {
  position: relative;
  transition: background .2s ease, color .2s ease, transform .18s ease,
    box-shadow .2s ease, border-color .2s ease;
}
.hero-pop::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px;
  background: conic-gradient(from var(--hero-angle), rgba(220,38,38,0) 0deg 248deg, var(--color-accent) 300deg, rgba(220,38,38,0) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  opacity: 0; transition: opacity .2s ease; pointer-events: none;
}
.hero-pop:hover, .hero-pop:focus-visible {
  background: #fff;
  color: var(--color-dark);
  transform: translateY(-1px);
  border-color: rgba(220,38,38,.35);
  box-shadow:
    0 6px 16px -6px rgba(220,38,38,.35),
    0 2px 6px rgba(15,23,42,.10);
}
.hero-pop:hover::before, .hero-pop:focus-visible::before {
  opacity: 1; animation: hero-trace 1.4s linear infinite;
}
.hero-pop:hover .hero-pop-ico, .hero-pop:focus-visible .hero-pop-ico { opacity: 1 !important; color: var(--color-accent); }
.hero-pop:active { transform: translateY(0); }
@keyframes hero-trace { to { --hero-angle: 360deg; } }
@media (prefers-reduced-motion: reduce) {
  .hero-pop { transition: background .2s ease, color .2s ease, border-color .2s ease; }
  .hero-pop:hover, .hero-pop:focus-visible { transform: none; }
  .hero-pop::before { transition: none; }
  .hero-pop:hover::before, .hero-pop:focus-visible::before {
    animation: none; background: var(--color-accent);
  }
}
`;

export function HeroSearch({
  stats,
  popular,
}: {
  stats: HeroStats;
  popular?: string[];
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Real most-searched terms when available; otherwise the curated defaults.
  const quickSearches =
    popular && popular.length > 0 ? popular.slice(0, 3) : QUICK_SEARCHES;

  function go(q: string) {
    const trimmed = q.trim();
    router.push(trimmed ? `/events?q=${encodeURIComponent(trimmed)}` : "/events");
  }

  // Log only typed submissions (not chip clicks) so the popular list reflects
  // genuine user searches rather than reinforcing the chips themselves.
  function logSearch(term: string) {
    try {
      fetch("/api/search-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* logging is best-effort */
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) logSearch(trimmed);
    go(query);
  }

  /* Mirror the manifesto band: same real values, only show counts > 0 so a
     stray "0" never undercuts the trust row. */
  const metrics = (
    [
      { key: "reviews", value: stats.reviewsCount, label: "verified reviews", icon: ICON_STAR, tone: "gold" as const },
      { key: "events", value: stats.eventsCount, label: "events listed", icon: ICON_CALENDAR, tone: "blue" as const },
      { key: "tournaments", value: stats.tournamentsCount, label: "tournaments listed", icon: ICON_TROPHY, tone: "red" as const },
    ]
  ).filter((m) => m.value > 0);

  return (
    <section className="relative" style={{ isolation: "isolate" }}>
      <style>{HERO_CSS}</style>
      {/* Photo zone — everything above the overlapping search card */}
      <div className="relative overflow-hidden">
        {/* Hero photo */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero.jpg"
            alt="Youth soccer tournament in action"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          {/* Dark overlay — a deep near-black with just a faint navy cast, at
             the previous gradient's strength (much darker, low intensity). */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,14,22,.34) 0%, rgba(9,13,20,.50) 32%, rgba(8,11,18,.66) 60%, rgba(6,9,16,.80) 85%, rgba(5,8,14,.88) 100%)",
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto w-full max-w-[680px] px-6 pt-16 pb-16 text-center md:pt-24 md:pb-20">
          {/* Badge chip — frosted pill, text only, with a hard (no-blur) third
             shadow under the soft drop + inset highlight for a crisp lifted edge. */}
          <div
            className="mb-6 inline-flex items-center rounded-full"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.06) 100%)",
              border: "1px solid rgba(255,255,255,.24)",
              color: "rgba(255,255,255,.95)",
              padding: "8px 18px",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow:
                "0 3px 0 rgba(8,11,20,.55), 0 10px 26px -12px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.24)",
            }}
          >
            <span
              className="font-heading uppercase"
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: ".13em",
                lineHeight: 1.1,
              }}
            >
              The most comprehensive youth sports tournament search engine
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-heading mx-auto"
            style={{
              fontSize: "clamp(40px, 8.5vw, 64px)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              color: "#fff",
              maxWidth: 600,
            }}
          >
            Welcome to
            <br />
            <HighlightSwipe>
              <span style={{ color: "#fff" }}>Tournament Guru</span>
            </HighlightSwipe>
          </h1>

          {/* Subtitle — sized to wrap onto two balanced lines */}
          <p
            className="mx-auto mt-5 mb-0"
            style={{
              fontSize: 17,
              color: "rgba(255,255,255,.86)",
              lineHeight: 1.55,
              maxWidth: 580,
              fontWeight: 500,
              textWrap: "balance",
            }}
          >
            Your one-stop shop to find the right event for{" "}
            <span style={{ fontWeight: 800, color: "#fff" }}>YOUR</span> team —
            chosen with reviews from people who actually went.
          </p>

          {/* Trust bar — one unified glass rail, three stats split by hairline
             dividers (vertical on desktop, horizontal when it stacks). */}
          {metrics.length > 0 && (
            <div className="mt-9 flex justify-center">
              <div
                className="inline-flex flex-col items-stretch overflow-hidden rounded-3xl sm:flex-row"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.05) 100%)",
                  border: "1px solid rgba(255,255,255,.18)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow:
                    "0 16px 38px -18px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.18)",
                }}
              >
                {metrics.map((m, i) => (
                  <Fragment key={m.key}>
                    {i > 0 && (
                      <span
                        aria-hidden="true"
                        className="h-px w-full shrink-0 sm:my-3 sm:h-auto sm:w-px"
                        style={{ background: "rgba(255,255,255,.15)" }}
                      />
                    )}
                    <StatItem
                      value={m.value}
                      label={m.label}
                      icon={m.icon}
                      tone={m.tone}
                    />
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlapping search card — straddles the photo → page seam */}
      <div
        className="relative z-20 mx-auto w-full max-w-[720px] px-6"
        style={{ marginTop: -34, marginBottom: -46 }}
      >
        <div
          className="rounded-[22px] bg-white"
          style={{
            padding: "16px 16px 14px",
            boxShadow:
              "0 24px 60px -20px rgba(15,23,42,.45), 0 2px 6px rgba(15,23,42,.08), 0 0 0 1px rgba(15,23,42,.03)",
          }}
        >
          <form onSubmit={handleSubmit}>
            <label htmlFor="hero-search" className="sr-only">
              Search tournaments
            </label>

            {/* Search row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div
                className="group relative flex flex-1 items-center overflow-hidden rounded-full border border-[var(--color-border)] transition-colors duration-200 hover:border-[var(--color-text-faint)] focus-within:border-[var(--color-accent)]"
                style={{ background: "#f8fafc" }}
              >
                <SearchIcon />
                <input
                  id="hero-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events by any keyword"
                  className="w-full bg-transparent py-3 pr-4 pl-11 text-[15px] text-dark placeholder-gray-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="font-heading shrink-0 cursor-pointer rounded-full px-7 py-3 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
                  boxShadow: "0 8px 20px -6px rgba(220,38,38,.5)",
                }}
              >
                Find Events
              </button>
            </div>
          </form>

          {/* Quick-search chips */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 pl-1">
            <span
              className="font-heading uppercase"
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: ".12em",
                color: "var(--color-text-faint)",
              }}
            >
              Popular
            </span>
            {quickSearches.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => go(q)}
                className="hero-pop inline-flex cursor-pointer items-center gap-1.5 rounded-full border"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "5px 13px",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-secondary)",
                  background: "var(--color-surface-alt)",
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="hero-pop-ico"
                  style={{ opacity: 0.55 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const ICON_COLOR = {
  gold: "var(--color-gold-bright)",
  blue: "#8ab0ff",
  red: "#f87171",
} as const;

function StatItem({
  value,
  label,
  icon,
  tone,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  tone: keyof typeof ICON_COLOR;
}) {
  const color = ICON_COLOR[tone];
  return (
    <div
      className="flex items-center justify-center gap-2.5"
      style={{ padding: "13px 22px" }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill={tone === "gold" ? color : "none"}
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {icon}
      </svg>
      <span className="inline-flex items-baseline gap-1.5">
        <b
          className="font-heading text-white"
          style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          {value.toLocaleString()}
        </b>
        <span
          style={{ fontSize: 12.5, color: "rgba(255,255,255,.82)", fontWeight: 600 }}
        >
          {label}
        </span>
      </span>
    </div>
  );
}

/* HighlightSwipe — the same hand-drawn marker swipe used behind "Gurus" in the
   "Hear from the Gurus" section, so the brand name gets a matching highlight. */
function HighlightSwipe({
  children,
  color = "rgba(220,38,38,.22)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <svg
        viewBox="0 0 200 44"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-3%",
          top: "-6%",
          width: "106%",
          height: "112%",
          zIndex: 0,
        }}
      >
        <path
          d="M6,26 C44,12 96,30 148,16 C176,9 194,20 197,14 C198,30 196,36 190,38 C150,46 104,28 58,38 C34,43 10,34 4,38 C2,32 2,30 6,26 Z"
          fill={color}
        />
      </svg>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-4 text-[#94a3b8] transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:scale-110 group-focus-within:translate-x-0.5 group-focus-within:text-[var(--color-accent)]"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
