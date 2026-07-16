"use client";

/* EventsSearch — the Find Events client orchestrator. Owns filter/sort/page
   state (seeded from SSR), fetches the extended /api/events/search endpoint on
   change, keeps the URL shareable, and drives the results list/grid + Leaflet
   map (with map↔list hover/active sync). Initial results come from the server
   for SEO; this only re-fetches on interaction. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { EventCard, type ClaimViewer } from "@/app/components/EventCard";
import { SponsoredBanner } from "@/app/components/SponsoredBanner";
import { HighlightSwipe } from "@/app/components/HighlightSwipe";
import type { EventRow, EventFacets, EventSort } from "@/app/components/types";
import {
  type Filters,
  EMPTY_FILTERS,
  buildFilterOptions,
  filtersToQuery,
  countActiveFilters,
} from "./taxonomy";
import { SearchFilterBar, type FilterGroupKey } from "./SearchFilterBar";
import { FilterDrawer } from "./FilterDrawer";
import { ResultsToolbar, type ViewMode } from "./ResultsToolbar";
import { Pagination } from "./Pagination";

const SearchMap = dynamic(() => import("./SearchMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center" style={{ background: "#e8eef3" }}>
      <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>
        Loading map…
      </span>
    </div>
  ),
});

type Props = {
  initialResults: EventRow[];
  initialTotal: number;
  facets: EventFacets;
  initialFilters: Filters;
  initialSort: EventSort;
  initialPage: number;
  pageSize: number;
  /** Same 3 metrics the homepage HeroSearch shows, so the trust row is
   *  consistent across the two entry points to the app. */
  stats: { events: number; reviews: number; tournaments: number };
  /** Viewer context for the per-card Claim CTA (computed server-side). */
  claimViewer: ClaimViewer;
  /** Event ids the signed-in viewer has favorited (their full set, so any
   *  card — initial or client-filtered — reflects the right heart state). */
  favoritedIds?: string[];
};

export function EventsSearch({
  initialResults,
  initialTotal,
  facets,
  initialFilters,
  initialSort,
  initialPage,
  pageSize,
  stats,
  claimViewer,
  favoritedIds,
}: Props) {
  const pathname = usePathname();
  const options = useMemo(() => buildFilterOptions(facets), [facets]);
  // Any signed-in viewer can favorite; anon gets the sign-in nudge.
  const canFavorite = claimViewer === "ed" || claimViewer === "other";
  const favoriteSet = useMemo(
    () => new Set(favoritedIds ?? []),
    [favoritedIds],
  );

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sort, setSort] = useState<EventSort>(initialSort);
  const [page, setPage] = useState(initialPage);

  const [results, setResults] = useState<EventRow[]>(initialResults);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFocus, setDrawerFocus] = useState<FilterGroupKey>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const activeFilterCount = countActiveFilters(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  /* Request query forces paged mode (page param present) + page size. */
  const requestQuery = useMemo(() => {
    const p = filtersToQuery(filters, sort, page);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [filters, sort, page, pageSize]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/search?${requestQuery}`, { signal: ctrl.signal });
        if (!res.ok) {
          // 429 (rate limit) has its own copy; everything else is generic.
          const msg =
            res.status === 429
              ? "You're searching a bit fast — try again in a moment."
              : "Search failed. Please try again.";
          setError(msg);
          // Preserve the previous result grid rather than blanking it on an
          // error — feels less broken and matches how most search UIs behave.
          return;
        }
        const json = await res.json();
        if (json.error) {
          setError(String(json.error));
          return;
        }
        setResults((json.events ?? []) as EventRow[]);
        setTotal(json.total ?? 0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
      // Keep the URL shareable without triggering a server re-render.
      const clean = filtersToQuery(filters, sort, page).toString();
      window.history.replaceState(null, "", clean ? `${pathname}?${clean}` : pathname);
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestQuery]);

  /* Scroll the matching card into view when a pin is activated. */
  useEffect(() => {
    if (!activeId) return;
    document
      .querySelector(`[data-card-id="${activeId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setActiveId(null);
  }, []);
  const setQuery = useCallback((q: string) => patchFilters({ q }), [patchFilters]);
  const changeSort = useCallback((s: EventSort) => {
    setSort(s);
    setPage(1);
  }, []);
  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setActiveId(null);
  }, []);
  const goPage = useCallback((p: number) => {
    setPage(p);
    setActiveId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openDrawer = useCallback((focus: FilterGroupKey) => {
    setDrawerFocus(focus);
    setDrawerOpen(true);
  }, []);

  const showSideMap = !mapCollapsed && !mapFullscreen;
  const resizeNonce = `${viewMode}-${mapCollapsed}-${mapFullscreen}`;

  // Split the current page's results into Featured (premium) and Standard
  // (non-premium) so we can wrap each with its own section header + info
  // tooltip per Franco's June 18 brief. Sponsor banner sits between them,
  // replacing the earlier "Recommended for you" strip.
  const featured = results.filter((r) => r.premium);
  const standard = results.filter((r) => !r.premium);
  const showSponsorSeparator = featured.length > 0 && standard.length > 0;

  const renderCard = (event: EventRow) => (
    <div
      key={event.id}
      data-card-id={event.id}
      onMouseEnter={() => setHoverId(event.id)}
      onMouseLeave={() => setHoverId(null)}
      className={
        activeId === event.id ? "rounded-2xl ring-2 ring-offset-1" : undefined
      }
      style={activeId === event.id ? { "--tw-ring-color": "var(--color-accent)" } as React.CSSProperties : undefined}
    >
      <EventCard
        event={event}
        claimViewer={claimViewer}
        favorited={favoriteSet.has(event.id)}
        canFavorite={canFavorite}
      />
    </div>
  );

  const gridClass =
    viewMode === "grid"
      ? "grid grid-cols-1 gap-3.5 xl:grid-cols-2"
      : "flex flex-col gap-2.5";

  return (
    <>
      <div className="tg-aurora" style={{ backgroundAttachment: "fixed" }}>
      {/* Sticky search + filters bar (offset below the site header) */}
      <div
        className="sticky top-[64px] z-40"
        style={{
          background: "rgba(246,249,252,0.72)",
          backdropFilter: "saturate(140%) blur(14px)",
          WebkitBackdropFilter: "saturate(140%) blur(14px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <SearchFilterBar
            filters={filters}
            options={options}
            activeFilterCount={activeFilterCount}
            onQueryChange={setQuery}
            onOpen={openDrawer}
            onClear={clearAll}
          />
        </div>
      </div>

      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-[44px] sm:px-6">
        <div
          className={
            "grid items-start gap-10 lg:gap-[60px] " +
            (showSideMap ? "lg:grid-cols-[minmax(0,1fr)_420px]" : "grid-cols-1")
          }
        >
          {/* Results column (header lives here so the map aligns with it) */}
          <div>
            <header className="mb-12">
              <h1
                className="font-heading text-[clamp(22px,3vw,28px)] font-extrabold leading-[1.15]"
                style={{ color: "var(--color-dark)", letterSpacing: "-0.025em", textWrap: "balance" }}
              >
                Find your next{" "}
                <span style={{ color: "var(--color-accent)" }}>tournament</span>{" "}
                using the world&rsquo;s first youth sports{" "}
                <HighlightSwipe>
                  {/* inherit 800 from the H1 — the browser's default `<b>` is
                     700 which read as visibly lighter than the surrounding
                     extrabold copy. Force it to match the parent. */}
                  <span style={{ fontWeight: 800 }}>search engine AND review platform</span>
                </HighlightSwipe>
              </h1>
              {/* Subtitle bumped to 16px — its role is "what the platform
                  actually does". At 14px it was reading as fine print. */}
              <p
                className="mt-3.5 max-w-2xl text-[16px] leading-[1.55]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Comprehensive tournament information paired with verified
                reviews from real coaches, team managers, and families &mdash;
                so you know which events are worth attending, not just which
                ones exist.
              </p>
              {(stats.events > 0 || stats.reviews > 0 || stats.tournaments > 0) && (
                <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
                  {stats.reviews > 0 && (
                    <StatBadge
                      value={stats.reviews.toLocaleString()}
                      label="reviews"
                      tint={{ bg: "#f7f2e6", iconBg: "#b45309", border: "#e8dcbf" }}
                      icon={<StarGlyph />}
                    />
                  )}
                  {stats.events > 0 && (
                    <StatBadge
                      value={stats.events.toLocaleString()}
                      label="events"
                      tint={{ bg: "#e2e8f0", iconBg: "var(--color-dark)", border: "#cbd5e1" }}
                      icon={<CalendarGlyph />}
                    />
                  )}
                  {stats.tournaments > 0 && (
                    <StatBadge
                      value={stats.tournaments.toLocaleString()}
                      label="tournaments"
                      tint={{ bg: "#fff1f2", iconBg: "var(--color-accent)", border: "#fecdd3" }}
                      icon={<TrophyGlyph />}
                    />
                  )}
                </div>
              )}
            </header>

            {/* Hero → results separator removed (Franco, Dec 2026): the
                red-dot hairline was reading as decorative noise between
                the stats block and the results toolbar. The added
                vertical rhythm (mb-12 on the header) provides the
                separation cleanly. */}

            <ResultsToolbar
              count={total}
              loading={loading}
              sort={sort}
              onSort={changeSort}
              viewMode={viewMode}
              onViewMode={setViewMode}
              mapCollapsed={mapCollapsed}
              onToggleMap={() => setMapCollapsed((v) => !v)}
              showMapToggle
            />

            {error && (
              <div
                className="mt-4 rounded-xl border px-4 py-3 text-[13px]"
                style={{ borderColor: "var(--color-accent)", background: "#fef2f2", color: "var(--color-accent-dark)" }}
                role="alert"
              >
                {error}
              </div>
            )}

            <div
              className={"mt-8 transition-opacity " + (loading ? "opacity-60" : "opacity-100")}
              aria-busy={loading}
            >
              {results.length === 0 && !loading ? (
                <EmptyState onReset={clearAll} hasFilters={activeFilterCount > 0 || !!filters.q.trim()} />
              ) : (
                <>
                  {featured.length > 0 && (
                    <section
                      aria-labelledby="tg-featured-heading"
                      className="mt-4"
                    >
                      <SectionHeader
                        id="tg-featured-heading"
                        title="Featured Events"
                        info={{
                          summary:
                            "Event Details verified by the event host, plus Coach & Manager Reviews from those who attended previously.",
                          detail: FEATURED_INFO,
                        }}
                      />
                      <div className={gridClass}>{featured.map(renderCard)}</div>
                    </section>
                  )}

                  {showSponsorSeparator && (
                    <div className="my-5">
                      <SponsoredBanner />
                    </div>
                  )}

                  {standard.length > 0 && (
                    <section
                      aria-labelledby="tg-listings-heading"
                      className={featured.length > 0 && !showSponsorSeparator ? "mt-6" : undefined}
                    >
                      <SectionHeader
                        id="tg-listings-heading"
                        title="Event Listings"
                        info={{
                          summary:
                            "Event Information and Attendee (parent / spectator) Reviews.",
                          detail: LISTINGS_INFO,
                        }}
                      />
                      <div className={gridClass}>{standard.map(renderCard)}</div>
                    </section>
                  )}
                </>
              )}
            </div>

            {results.length > 0 && (
              <Pagination
                page={page}
                pageCount={pageCount}
                total={total}
                pageSize={pageSize}
                onPage={goPage}
              />
            )}
          </div>

          {/* Side map (desktop only). Same double-shadow as the results
              toolbar so the two white surfaces read as one visual system
              sitting on the aurora backdrop, rather than the map floating
              alone with just a hairline border. */}
          {showSideMap && (
            <div
              className="sticky top-[148px] hidden overflow-hidden rounded-2xl border bg-white lg:block"
              style={{
                height: "calc(100vh - 172px)",
                borderColor: "var(--color-border)",
                boxShadow:
                  "0 2px 6px rgba(15,23,42,.06), 0 12px 28px -14px rgba(15,23,42,.16)",
              }}
            >
              <SearchMap
                events={results}
                activeId={activeId}
                hoverId={hoverId}
                onActiveChange={setActiveId}
                onCollapse={() => setMapCollapsed(true)}
                onToggleFullscreen={() => setMapFullscreen(true)}
                resizeNonce={resizeNonce}
              />
            </div>
          )}
        </div>
      </main>
      </div>

      {/* Floating "Show map" — desktop, when the side map is collapsed */}
      {mapCollapsed && !mapFullscreen && (
        <button
          onClick={() => setMapCollapsed(false)}
          className="font-heading fixed bottom-6 right-6 z-[80] hidden items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-white shadow-lg lg:flex"
          style={{ background: "var(--color-dark)" }}
        >
          <MapGlyph /> Show map
        </button>
      )}

      {/* Floating "View map" — mobile/tablet opens fullscreen */}
      {!mapFullscreen && (
        <button
          onClick={() => setMapFullscreen(true)}
          className="font-heading fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold text-white shadow-lg lg:hidden"
          style={{ background: "var(--color-dark)" }}
        >
          <MapGlyph /> View map
        </button>
      )}

      {/* Fullscreen map overlay (all breakpoints) */}
      {mapFullscreen && (
        <div className="fixed inset-0 z-[200]">
          <SearchMap
            events={results}
            activeId={activeId}
            hoverId={hoverId}
            onActiveChange={setActiveId}
            fullscreen
            onToggleFullscreen={() => setMapFullscreen(false)}
            resizeNonce={resizeNonce}
          />
        </div>
      )}

      <FilterDrawer
        open={drawerOpen}
        focus={drawerFocus}
        filters={filters}
        options={options}
        resultCount={total}
        loading={loading}
        onChange={patchFilters}
        onClose={() => setDrawerOpen(false)}
        onReset={clearAll}
      />
    </>
  );
}

// HighlightSwipe is imported from ../HighlightSwipe.

/* Round-icon stat pill in the header, brand palette only. The number is the
   hero of the chip — value is now noticeably larger than the label so the
   eye lands on it first and the label reads as caption. */
function StatBadge({
  icon,
  value,
  label,
  tint,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tint: { bg: string; iconBg: string; border: string };
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full"
      style={{ background: tint.bg, border: `1px solid ${tint.border}`, padding: "5px 12px 5px 5px" }}
    >
      <span
        className="inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: tint.iconBg }}
      >
        {icon}
      </span>
      <span className="inline-flex items-baseline gap-1">
        <b
          className="font-heading text-[14px] font-extrabold"
          style={{ color: "var(--color-dark)", letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          {value}
        </b>
        <span
          className="text-[10.5px] font-semibold uppercase"
          style={{ color: "var(--color-text-secondary)", letterSpacing: ".06em" }}
        >
          {label}
        </span>
      </span>
    </div>
  );
}

function TrophyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M6 4h12v5a6 6 0 01-12 0V4zM12 15v4M8 21h8" />
    </svg>
  );
}
function StarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
    </svg>
  );
}
function CalendarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

/* ── Section header for Featured / Listings ─────────────────────────────────
   Per Franco's brief the section is titled prominently — reads as a real
   heading, not a small eyebrow — and the full explanation lives behind an (i)
   affordance so we don't push results below the fold with a paragraph of
   copy. Short one-line summary stays visible under the title. */

const FEATURED_INFO =
  "Featured Events include Event Details verified by the event host and verified Coach & Manager Reviews from those who attended previously, plus Attendee Reviews from parents and spectators. The most comprehensive picture of what to expect before you attend. All Featured Event profiles are managed by the event operators.";

const LISTINGS_INFO =
  "Listings include Event Information and Attendee (parent / spectator) Reviews. Event listings with the checkmark indicate that this event profile is maintained by the event organizer. Listings without it are created by Tournament Guru using publicly available information — details should be confirmed with the organizer.";

function SectionHeader({
  id,
  title,
  info,
}: {
  id?: string;
  title: string;
  info: { summary: string; detail: string };
}) {
  return (
    <div className="mb-5">
      {/* items-center + a small nudge-up on the (i) keeps the tooltip icon
          visually centered on the H2's cap-height rather than dropping to
          its descender line (which items-baseline caused). */}
      <div className="flex items-center gap-2.5">
        <h2
          id={id}
          className="font-heading"
          style={{
            fontSize: "clamp(18px, 2.2vw, 22px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--color-dark)",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <InfoTooltip label={`About ${title}`} detail={info.detail} />
      </div>
      <p
        className="max-w-3xl"
        style={{
          fontSize: 13.5,
          lineHeight: 1.5,
          color: "var(--color-text-secondary)",
          margin: "6px 0 0",
        }}
      >
        {info.summary}
      </p>
    </div>
  );
}

/* Pure-CSS tooltip. Hover / focus on the (i) shows a floating dark bubble
   with the full explanation. Opacity + transform + pointer-events live
   ENTIRELY in the CSS class — the earlier version set them inline as well,
   and inline styles beat class rules on specificity, so the CSS :hover
   swap never took effect and the bubble stayed invisible. */
function InfoTooltip({ label, detail }: { label: string; detail: string }) {
  return (
    <span
      className="tg-info-wrap relative inline-flex shrink-0 self-center"
      tabIndex={0}
      role="button"
      aria-label={label}
      style={{ outline: "none" }}
    >
      <span
        aria-hidden="true"
        className="font-heading inline-flex h-[20px] w-[20px] items-center justify-center rounded-full"
        style={{
          fontSize: 11,
          fontWeight: 800,
          // Neutralized from brand-red to slate: the info glyph is a
          // reference cue, not a call to action, so the red was reading
          // as "warning". Still visibly separated from body text via
          // the surface-alt fill + 300-slate border ring.
          color: "var(--color-text-secondary)",
          background: "var(--color-surface-alt)",
          border: "1px solid #cbd5e1",
          cursor: "help",
        }}
      >
        i
      </span>
      <span
        role="tooltip"
        className="tg-info-bubble"
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          zIndex: 40,
          minWidth: 260,
          maxWidth: 380,
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--color-dark)",
          color: "rgba(255,255,255,.92)",
          fontSize: 12.5,
          lineHeight: 1.55,
          boxShadow: "0 14px 32px -10px rgba(15,23,42,.55)",
          whiteSpace: "normal",
        }}
      >
        {detail}
      </span>
      <style>{`
        .tg-info-bubble {
          opacity: 0;
          transform: translateY(-4px);
          pointer-events: none;
          transition: opacity .16s ease, transform .16s ease;
        }
        .tg-info-wrap:hover .tg-info-bubble,
        .tg-info-wrap:focus-within .tg-info-bubble {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
      `}</style>
    </span>
  );
}

function MapGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 5L3 7v12l6-2 6 2 6-2V5l-6 2-6-2z" strokeLinejoin="round" />
      <path d="M9 5v12M15 7v12" />
    </svg>
  );
}

function EmptyState({ onReset, hasFilters }: { onReset: () => void; hasFilters: boolean }) {
  return (
    <div
      className="rounded-2xl border border-dashed bg-white p-10 text-center"
      style={{ borderColor: "#cbd5e1" }}
    >
      <div className="mb-2 text-[32px]" aria-hidden="true">
        🥅
      </div>
      <div className="text-[16px] font-bold" style={{ color: "var(--color-dark)" }}>
        No tournaments match your filters
      </div>
      <div className="mt-1 text-[13px]" style={{ color: "var(--color-text-muted)" }}>
        {hasFilters
          ? "Try widening your age range, level, region, or dates."
          : "Check back soon — new events are added regularly."}
      </div>
      {hasFilters && (
        <button
          onClick={onReset}
          className="mt-3.5 rounded-[10px] px-[18px] py-2.5 text-[13px] font-semibold text-white"
          style={{ background: "var(--color-dark)" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
