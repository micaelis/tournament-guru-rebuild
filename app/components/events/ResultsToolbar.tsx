"use client";

/* ResultsToolbar — result count, list/grid toggle, hide/show-map, sort.
   Mirrors the prototype ResultsHeader control row. */

import { SORT_OPTIONS } from "./taxonomy";
import type { EventSort } from "@/app/components/types";

export type ViewMode = "list" | "grid";

export function ResultsToolbar({
  count,
  loading,
  sort,
  onSort,
  viewMode,
  onViewMode,
  mapCollapsed,
  onToggleMap,
  showMapToggle,
}: {
  count: number;
  loading: boolean;
  sort: EventSort;
  onSort: (s: EventSort) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  mapCollapsed: boolean;
  onToggleMap: () => void;
  showMapToggle: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2.5"
      style={{
        borderColor: "var(--color-border)",
        // Soft double-shadow lifts the toolbar off the aurora backdrop
        // and keys it visually to the search box above (same 2-layer shadow).
        boxShadow:
          "0 2px 6px rgba(15,23,42,.06), 0 12px 28px -14px rgba(15,23,42,.16)",
      }}
    >
      <div className="inline-flex items-center gap-2.5" aria-live="polite">
        <span
          className="font-heading rounded-[9px] px-2.5 py-1 text-[20px] font-extrabold leading-none"
          style={{
            // Neutralized from accent red → dark slate: the count is a
            // status readout, not a call to action, so the brand red was
            // reading as urgency where none was intended.
            color: "var(--color-dark)",
            background: "var(--color-surface-alt)",
            border: "1px solid var(--color-border)",
            letterSpacing: "-0.02em",
          }}
        >
          {loading ? "…" : count}
        </span>
        <span
          className="text-[11.5px] font-bold uppercase"
          style={{ color: "var(--color-text-muted)", letterSpacing: ".08em" }}
        >
          {count === 1 ? "event" : "events"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div
          className="inline-flex rounded-[10px] border bg-white p-[3px]"
          style={{ borderColor: "var(--color-border)" }}
          role="group"
          aria-label="View mode"
        >
          {(["list", "grid"] as ViewMode[]).map((v) => {
            const active = viewMode === v;
            return (
              <button
                key={v}
                onClick={() => onViewMode(v)}
                aria-pressed={active}
                title={`${v[0].toUpperCase()}${v.slice(1)} view`}
                className="tg-hover inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-[5px] text-[12px] font-semibold capitalize"
                style={{
                  background: active ? "var(--color-dark)" : "transparent",
                  color: active ? "#fff" : "var(--color-text-secondary)",
                }}
              >
                {v === "list" ? <IconList /> : <IconGrid />}
                <span className="hidden sm:inline">{v}</span>
              </button>
            );
          })}
        </div>

        {showMapToggle && (
          <button
            onClick={onToggleMap}
            className="tg-hover inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-[7px] text-[12.5px] font-semibold"
            style={{
              background: mapCollapsed ? "var(--color-dark)" : "#fff",
              color: mapCollapsed ? "#fff" : "var(--color-dark)",
              borderColor: mapCollapsed ? "var(--color-dark)" : "var(--color-border)",
            }}
            title={mapCollapsed ? "Show map" : "Hide map"}
          >
            <IconMap />
            <span className="hidden md:inline">{mapCollapsed ? "Show map" : "Hide map"}</span>
          </button>
        )}

        <span
          className="hidden h-[22px] w-px sm:block"
          style={{ background: "var(--color-border)" }}
        />

        <label
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "var(--color-text-faint)" }}
        >
          <span className="hidden sm:inline">Sort by</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as EventSort)}
            className="tg-hover cursor-pointer rounded-[10px] border bg-white py-[7px] pl-3 pr-8 text-[13px] font-semibold"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-dark)",
              appearance: "none",
              WebkitAppearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconMap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 5L3 7v12l6-2 6 2 6-2V5l-6 2-6-2z" strokeLinejoin="round" />
      <path d="M9 5v12M15 7v12" />
    </svg>
  );
}
