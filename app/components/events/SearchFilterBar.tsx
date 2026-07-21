"use client";

/* SearchFilterBar — full-width search + quick filter chips + "All filters".
   Chips summarise the active selection and open the drawer focused on that
   group. Collapses to search + a single Filters button on mobile. */

import { cn, textLinkClass } from "@/app/components/ui";
import {
  type Filters,
  type FilterOptions,
  ageLabel,
  genderLabel,
  levelLabel,
  stateShort,
  summarize,
  distanceActive,
} from "./taxonomy";

export type FilterGroupKey =
  | "dates"
  | "distance"
  | "ages"
  | "genders"
  | "levels"
  | "surfaces"
  | "states"
  | "all";

function dateSummary(f: Filters): string | null {
  const fmt = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (f.dateStart && f.dateEnd) return `${fmt(f.dateStart)} – ${fmt(f.dateEnd)}`;
  if (f.dateStart) return `from ${fmt(f.dateStart)}`;
  if (f.dateEnd) return `until ${fmt(f.dateEnd)}`;
  return null;
}

/* Search box states — pared back to just two visual tiers per Franco's
   ask (Dec 2026):
     • default        → soft double-shadow, transparent border
     • hover / focus  → slightly deeper shadow + faint slate border tint
                        (both interactions share ONE visual, so the box
                         doesn't jump between hover and focus rings)
     • .active        → very soft pink border + faint pink halo when a
                        query is applied. Dropped from ~32% down to
                        ~14% opacity so it reads as a whisper, not a
                        neon warning.
   The close X's base color / background stay in the CSS class rather
   than the JSX style prop, otherwise inline specificity blocks the
   hover from ever landing. */
const SEARCH_FOCUS_CSS = `
  .tg-search-focus {
    border: 1px solid transparent;
    box-shadow:
      0 2px 6px rgba(15,23,42,.07),
      0 10px 24px -8px rgba(15,23,42,.15);
    transition:
      box-shadow .18s ease,
      border-color .18s ease,
      transform .12s ease;
  }
  .tg-search-focus:hover,
  .tg-search-focus:focus-within {
    border-color: rgba(15,23,42,.10);
    box-shadow:
      0 3px 8px rgba(15,23,42,.09),
      0 14px 30px -8px rgba(15,23,42,.20);
    transform: translateY(-0.5px);
  }
  .tg-search-focus.tg-search-active {
    border-color: rgba(220,38,38,.16);
    box-shadow:
      0 2px 6px rgba(15,23,42,.07),
      0 10px 24px -8px rgba(220,38,38,.10);
  }
  .tg-search-focus.tg-search-active:hover,
  .tg-search-focus.tg-search-active:focus-within {
    border-color: rgba(220,38,38,.24);
    box-shadow:
      0 3px 8px rgba(15,23,42,.09),
      0 14px 30px -8px rgba(220,38,38,.14);
    transform: translateY(-0.5px);
  }

  .tg-search-clear {
    color: var(--color-text-faint);
    background: transparent;
    border: 0;
    transition: background .15s ease, color .15s ease, transform .1s ease;
  }
  .tg-search-clear:hover,
  .tg-search-clear:focus-visible {
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    color: var(--color-accent);
  }
  .tg-search-clear:active { transform: scale(0.9); }
`;

export function SearchFilterBar({
  filters,
  options,
  activeFilterCount,
  onQueryChange,
  onOpen,
  onClear,
  onClearDistance,
}: {
  filters: Filters;
  options: FilterOptions;
  activeFilterCount: number;
  onQueryChange: (q: string) => void;
  onOpen: (focus: FilterGroupKey) => void;
  onClear: () => void;
  onClearDistance: () => void;
}) {
  // Distance replaced Format in the subheader per the spec ("add it in the
  // subheader with filters and swap it with Format") — Format still lives
  // in the drawer. The distance chip carries its own inline reset so the
  // pre-applied profile preference is one click to drop.
  const distSummary = distanceActive(filters)
    ? `${filters.distMiles} mi${filters.distLoc ? ` · ${filters.distLoc}` : ""}`
    : null;
  const chips: { key: FilterGroupKey; label: string; icon: React.ReactNode; summary: string | null; show: boolean; onReset?: () => void }[] = [
    { key: "dates", label: "Dates", icon: <IconCal />, summary: dateSummary(filters), show: true },
    { key: "distance", label: "Distance", icon: <IconRadar />, summary: distSummary, show: true, onReset: distSummary ? onClearDistance : undefined },
    { key: "ages", label: "Age", icon: <IconAge />, summary: summarize(filters.ages, ageLabel), show: options.ages.length > 0 },
    { key: "genders", label: "Gender", icon: <IconGender />, summary: summarize(filters.genders, genderLabel), show: options.genders.length > 0 },
    { key: "levels", label: "Level", icon: <IconStar />, summary: summarize(filters.levels, levelLabel), show: options.levels.length > 0 },
    { key: "states", label: "States", icon: <IconPin />, summary: summarize(filters.states, stateShort), show: options.states.length > 0 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 py-3.5">
      <style>{SEARCH_FOCUS_CSS}</style>
      {/* Search box — 48px (h-12). All state styling (default, hover,
          focus-within, active) lives in `SEARCH_FOCUS_CSS` above — moved
          off the JSX `style` prop so pseudo-class rules can actually
          override the defaults (inline styles beat class rules 1000:1
          on specificity, which was blocking the hover from landing). */}
      <div
        className={`tg-search-focus flex h-12 min-w-[240px] flex-[1_1_300px] items-center gap-2.5 rounded-[14px] bg-white pl-1.5 pr-2${
          filters.q ? " tg-search-active" : ""
        }`}
      >
        <span
          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 9%, transparent)",
            color: "var(--color-accent)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          aria-label="Search tournaments, cities, or clubs"
          placeholder="Search tournaments, cities, clubs…"
          value={filters.q}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full border-0 bg-transparent p-0 text-[14.5px] font-medium outline-none"
          style={{ color: "var(--color-dark)" }}
        />
        {filters.q && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="tg-search-clear mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick chips — hidden below lg, replaced by the Filters button */}
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {chips
          .filter((c) => c.show)
          .map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              icon={chip.icon}
              summary={chip.summary}
              onClick={() => onOpen(chip.key)}
              onReset={chip.onReset}
            />
          ))}
      </div>

      {/* All filters — matches the filter chip height (h-10, 40px), so the
          secondary controls read as a lighter tier under the search box. */}
      <button
        onClick={() => onOpen("all")}
        className="tg-allfilters font-heading inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-bold text-white"
        style={{
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid #0f172a",
          boxShadow: "0 6px 16px -5px rgba(15,23,42,.5)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">All filters</span>
        <span className="sm:hidden">Filters</span>
        {activeFilterCount > 0 && (
          <span
            className="rounded-full px-[7px] py-px text-[11px] font-extrabold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            {activeFilterCount}
          </span>
        )}
      </button>

      {activeFilterCount > 0 && (
        <button
          onClick={onClear}
          className={cn(textLinkClass, "cursor-pointer text-[13px]")}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function FilterChip({
  label,
  icon,
  summary,
  onClick,
  onReset,
}: {
  label: string;
  icon: React.ReactNode;
  summary: string | null;
  onClick: () => void;
  /** Inline ✕ that clears just this chip without opening the drawer. */
  onReset?: () => void;
}) {
  const active = !!summary;
  return (
    <div
      className="tg-fchip inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full text-[12.5px] font-semibold"
      style={{
        background: active ? "var(--color-dark)" : "#fff",
        color: active ? "#fff" : "#1e293b",
        boxShadow:
          "0 2px 6px rgba(15,23,42,.07), 0 10px 24px -8px rgba(15,23,42,.15)",
      }}
    >
      <button
        onClick={onClick}
        className={`inline-flex h-full cursor-pointer items-center gap-2 rounded-full bg-transparent pl-[14px] ${
          active && onReset ? "pr-1" : "pr-[14px]"
        }`}
        style={{ color: "inherit", border: 0, font: "inherit" }}
      >
        <span className="flex" style={{ color: active ? "#fff" : "var(--color-accent)" }}>
          {icon}
        </span>
        {summary ? (
          <span>
            {label}: <b className="font-extrabold">{summary}</b>
          </span>
        ) : (
          label
        )}
      </button>
      {active && onReset && (
        <button
          onClick={onReset}
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="mr-1.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/30"
          style={{ color: "#fff", border: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function IconCal() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" /></svg>;
}
function IconAge() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" strokeLinecap="round" /></svg>;
}
function IconGender() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="14" r="4" /><circle cx="17" cy="8" r="3" /></svg>;
}
function IconStar() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" /></svg>;
}
function IconRadar() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="2.5" /><path d="M12 4.5a7.5 7.5 0 017.5 7.5M12 1a11 11 0 0111 11" strokeLinecap="round" /></svg>;
}
function IconPin() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" /></svg>;
}
