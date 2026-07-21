"use client";

/* FilterDrawer — the full filter surface (also the mobile filter UI). Slides in
   from the right, closes on Escape / backdrop, traps initial focus, and locks
   body scroll while open. Every group reads from the real facet options. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Filters,
  type FilterOptions,
  ageLabel,
  genderLabel,
  surfaceLabel,
  stateLabel,
  LEVEL_META,
} from "./taxonomy";
import type { FilterGroupKey } from "./SearchFilterBar";
import { LocationAutocomplete } from "@/app/components/LocationAutocomplete";
import { cn, textLinkClass } from "@/app/components/ui";
import { USDateText } from "@/app/components/ui/USDateInput";
import { DISTANCE_OPTIONS } from "@/lib/geo";

type Patch = Partial<Filters>;

export function FilterDrawer({
  open,
  focus,
  filters,
  options,
  resultCount,
  loading,
  onChange,
  onClose,
  onReset,
}: {
  open: boolean;
  focus: FilterGroupKey;
  filters: Filters;
  options: FilterOptions;
  resultCount: number;
  loading: boolean;
  onChange: (patch: Patch) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Read onClose through a ref so the open-effect depends ONLY on `open`.
  // With onClose in the deps, a parent re-render (every keystroke in the
  // distance box patches the filters) re-ran the effect and its
  // `closeRef.current?.focus()` stole focus to the ✕ button mid-typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const toggle = (key: keyof Filters, value: string) => {
    const arr = (filters[key] as string[]) || [];
    onChange({
      [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
    } as Patch);
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,23,42,.4)", animation: "tgFadeIn .18s ease-out" }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter tournaments"
        className="absolute inset-y-0 right-0 flex w-[min(480px,100vw)] flex-col bg-white"
        style={{
          boxShadow: "-20px 0 60px rgba(15,23,42,.2)",
          animation: "tgSlideIn .22s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-[22px] py-[18px]"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div>
            <div className="text-[17px] font-bold" style={{ color: "var(--color-dark)" }}>
              Filters
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
              Narrow down to the right tournament
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close filters"
            className="tg-hover flex h-8 w-8 items-center justify-center rounded-[10px]"
            style={{ background: "var(--color-surface-alt)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-dark)" strokeWidth="2.2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[22px] pb-[22px] pt-1.5">
          {/* Group ORDER: quick top-level toggles first (Dates + Registration
              open-only), then the demographic filters with States directly
              below Gender (Round-2 #8 — geography belongs with the
              who-is-this-for cluster, not exiled to the bottom), ending with
              Level + Surface. */}
          <Group label="Dates" hilite={focus === "dates"}>
            <div className="flex gap-2">
              <DateField label="From" value={filters.dateStart} onChange={(v) => onChange({ dateStart: v })} />
              <DateField label="To" value={filters.dateEnd} onChange={(v) => onChange({ dateEnd: v })} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => onChange(p.range())}
                  className="tg-hover cursor-pointer rounded-full border px-2.5 py-[5px] text-[12px] font-medium"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "#334155" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Group>

          <Group
            label="Distance from"
            hilite={focus === "distance"}
            subtitle="Results start within your travel range — reset any time"
          >
            <LocationAutocomplete
              label="Your location"
              name="__distance_location"
              placeholder="City, State, or Zip Code"
              defaultValue={filters.distLoc}
              onResolved={(place) =>
                onChange(
                  place
                    ? {
                        distLat: place.lat,
                        distLng: place.lng,
                        distLoc:
                          place.city && place.stateAbbr
                            ? `${place.city}, ${place.stateAbbr}`
                            : place.formatted,
                        // Picking a place implies wanting the filter on.
                        distMiles: filters.distMiles ?? 150,
                        distCleared: false,
                      }
                    : { distLat: null, distLng: null, distLoc: "" },
                )
              }
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {DISTANCE_OPTIONS.map((o) => {
                const active =
                  o.miles === null
                    ? filters.distMiles == null
                    : filters.distMiles === o.miles;
                return (
                  <button
                    key={o.value}
                    onClick={() =>
                      onChange(
                        o.miles === null
                          ? { distMiles: null, distCleared: true }
                          : { distMiles: o.miles, distCleared: false },
                      )
                    }
                    aria-pressed={active}
                    className="tg-hover cursor-pointer rounded-full border px-2.5 py-[5px] text-[12px] font-medium"
                    style={{
                      background: active ? "var(--color-dark)" : "var(--color-surface)",
                      borderColor: active ? "var(--color-dark)" : "var(--color-border)",
                      color: active ? "#fff" : "#334155",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {filters.distMiles != null && filters.distLat == null && (
              <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--color-accent)" }}>
                Pick a location above to apply the distance filter.
              </p>
            )}
          </Group>

          <Group label="Registration">
            <SwitchRow
              label="Only show open registration"
              value={filters.openOnly}
              onChange={(v) => onChange({ openOnly: v })}
            />
          </Group>

          {options.ages.length > 0 && (
            <Group label="Age group" hilite={focus === "ages"}>
              <ChipGrid
                options={options.ages}
                label={ageLabel}
                selected={filters.ages}
                onToggle={(v) => toggle("ages", v)}
                cols={6}
              />
            </Group>
          )}

          {options.genders.length > 0 && (
            <Group label="Gender" hilite={focus === "genders"}>
              <Segmented
                options={options.genders}
                label={genderLabel}
                selected={filters.genders}
                onToggle={(v) => toggle("genders", v)}
              />
            </Group>
          )}

          {options.states.length > 0 && (
            <Group
              label="States"
              hilite={focus === "states"}
              subtitle="Multi-select"
            >
              <StatesChecklist
                options={options.states}
                selected={filters.states}
                onToggle={(v) => toggle("states", v)}
                onSelectAll={() => onChange({ states: [] })}
              />
            </Group>
          )}

          {options.levels.length > 0 && (
            <Group label="Level of competition" hilite={focus === "levels"} subtitle="Highest = ECNL / MLS Next caliber">
              <div className="grid gap-2">
                {options.levels.map((l) => (
                  <LevelRow
                    key={l}
                    value={l}
                    selected={filters.levels.includes(l)}
                    onClick={() => toggle("levels", l)}
                  />
                ))}
              </div>
            </Group>
          )}

          {options.surfaces.length > 0 && (
            <Group label="Field surface" hilite={focus === "surfaces"}>
              <Segmented
                options={options.surfaces}
                label={surfaceLabel}
                selected={filters.surfaces}
                onToggle={(v) => toggle("surfaces", v)}
              />
            </Group>
          )}

          {/* Subtle end-of-list marker — fills the void when the drawer is
              only carrying a couple of groups, and gives the scroll a clear
              "you've reached the end" cue when it's long. */}
          <div
            className="mt-2 flex items-center gap-2.5 pt-3"
            aria-hidden="true"
          >
            <span
              className="h-px flex-1"
              style={{ background: "var(--color-border)" }}
            />
            <span
              className="font-heading uppercase"
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".16em",
                color: "var(--color-text-faint)",
              }}
            >
              End of filters
            </span>
            <span
              className="h-px flex-1"
              style={{ background: "var(--color-border)" }}
            />
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-3 border-t px-[22px] py-3.5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            onClick={onReset}
            className={cn(textLinkClass, "text-[13.5px]")}
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="tg-hover flex-1 rounded-xl px-[18px] py-3 text-[14px] font-semibold text-white"
            style={{ maxWidth: 260, background: "var(--color-dark)" }}
          >
            {loading ? "Searching…" : `Show ${resultCount} tournament${resultCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Date presets (relative to today) ── */
const DATE_PRESETS: { label: string; range: () => Patch }[] = [
  {
    label: "This weekend",
    range: () => {
      const now = new Date();
      const sat = new Date(now);
      sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7));
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);
      return { dateStart: iso(sat), dateEnd: iso(sun) };
    },
  },
  {
    label: "Next 30 days",
    range: () => {
      const now = new Date();
      const end = new Date(now);
      end.setDate(now.getDate() + 30);
      return { dateStart: iso(now), dateEnd: iso(end) };
    },
  },
  {
    label: "This summer",
    range: () => {
      const y = new Date().getFullYear();
      return { dateStart: `${y}-06-01`, dateEnd: `${y}-08-31` };
    },
  },
  {
    label: "Holiday",
    range: () => {
      const y = new Date().getFullYear();
      return { dateStart: `${y}-12-20`, dateEnd: `${y + 1}-01-05` };
    },
  },
];
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function Group({
  label,
  subtitle,
  hilite,
  children,
}: {
  label: string;
  subtitle?: string;
  hilite?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-b py-[18px]" style={{ borderColor: "var(--color-border-light)" }}>
      {hilite && (
        <span
          className="absolute -left-2.5 w-[3px] rounded"
          style={{ top: 22, bottom: 22, background: "var(--color-dark)" }}
          aria-hidden="true"
        />
      )}
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[14px] font-bold" style={{ color: "var(--color-dark)" }}>
          {label}
        </div>
        {subtitle && (
          <div className="text-[11.5px]" style={{ color: "var(--color-text-faint)" }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label
      className="tg-focus-field flex-1 rounded-[10px] border px-3 py-2"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="text-[10.5px] font-semibold uppercase" style={{ color: "var(--color-text-faint)", letterSpacing: ".06em" }}>
        {label}
      </div>
      {/* Masked mm/dd/yyyy — a native date input shows the BROWSER
          locale's placeholder (dd/mm/yyyy abroad). */}
      <USDateText
        iso={value}
        onIsoChange={onChange}
        aria-label={`${label} date`}
        className="w-full border-0 bg-transparent py-0.5 text-[14px] outline-none"
        style={{ color: "var(--color-dark)" }}
      />
    </label>
  );
}

function ChipGrid({
  options,
  label,
  selected,
  onToggle,
  cols,
}: {
  options: string[];
  label: (v: string) => string;
  selected: string[];
  onToggle: (v: string) => void;
  cols: number;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            aria-pressed={on}
            className="tg-hover rounded-lg border px-1 py-2 text-[12.5px] font-semibold"
            style={{
              background: on ? "var(--color-dark)" : "#fff",
              color: on ? "#fff" : "var(--color-dark)",
              borderColor: on ? "var(--color-dark)" : "var(--color-border)",
            }}
          >
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

function Segmented({
  options,
  label,
  selected,
  onToggle,
}: {
  options: string[];
  label: (v: string) => string;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div
      className="flex gap-0.5 rounded-[10px] p-1"
      style={{ background: "var(--color-surface-alt)" }}
    >
      {options.map((o) => {
        const on = selected.includes(o);
        // Matches the ChipGrid + LevelRow style used by the other filter
        // groups: selected reads as inverted (dark bg + white text), so the
        // active option stands out clearly against the light-grey rail.
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            aria-pressed={on}
            className="tg-hover cursor-pointer flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: on ? "var(--color-dark)" : "transparent",
              color: on ? "#fff" : "var(--color-text-secondary)",
              boxShadow: on
                ? "0 2px 6px -1px rgba(15,23,42,.35)"
                : "none",
            }}
          >
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

function LevelRow({ value, selected, onClick }: { value: string; selected: boolean; onClick: () => void }) {
  const meta = LEVEL_META[value] ?? { label: value, desc: "" };
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="tg-hover flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left"
      style={{
        background: selected ? "var(--color-dark)" : "#fff",
        color: selected ? "#fff" : "var(--color-dark)",
        borderColor: selected ? "var(--color-dark)" : "var(--color-border)",
      }}
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border"
        style={{
          borderColor: selected ? "#fff" : "#cbd5e1",
          background: selected ? "#fff" : "transparent",
        }}
      >
        {selected && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-dark)" strokeWidth="3" aria-hidden="true">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span>
        <span className="block text-[13.5px] font-bold">{meta.label}</span>
        <span className="block text-[11.5px]" style={{ opacity: 0.7 }}>
          {meta.desc}
        </span>
      </span>
    </button>
  );
}

/* States — a two-column checkbox list with a search box and a "Clear" affordance.
   50 items is too many for a pill grid; the checklist stays scannable and lets
   the user narrow by typing. */
function StatesChecklist({
  options,
  selected,
  onToggle,
  onSelectAll,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onSelectAll: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((code) => {
      const label = stateLabel(code).toLowerCase();
      return code.toLowerCase().includes(term) || label.includes(term);
    });
  }, [options, q]);

  return (
    <div>
      <div
        className="flex h-10 items-center gap-2 rounded-[10px] border px-2.5"
        style={{ borderColor: "var(--color-border)", background: "#fff" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: "var(--color-text-muted)" }}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Filter states…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border-0 bg-transparent p-0 text-[13px] outline-none"
          style={{ color: "var(--color-dark)" }}
          aria-label="Filter states"
        />
        {selected.length > 0 && (
          <button
            onClick={onSelectAll}
            className="tg-hover shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-semibold"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Clear selected states"
          >
            Clear
          </button>
        )}
      </div>

      <div
        className="mt-2 grid gap-y-1 gap-x-2 overflow-y-auto rounded-[10px] border p-2"
        style={{
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          maxHeight: 260,
          borderColor: "var(--color-border-light)",
          background: "var(--color-surface)",
        }}
      >
        {filtered.length === 0 ? (
          <div
            className="col-span-2 py-6 text-center text-[12.5px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            No states match “{q}”
          </div>
        ) : (
          filtered.map((code) => {
            const on = selected.includes(code);
            return (
              <label
                key={code}
                className="tg-hover flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
                style={{
                  background: on ? "#fff" : "transparent",
                  border: `1px solid ${on ? "var(--color-border)" : "transparent"}`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border"
                  style={{
                    background: on ? "var(--color-dark)" : "#fff",
                    borderColor: on ? "var(--color-dark)" : "#cbd5e1",
                  }}
                >
                  {on && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(code)}
                  className="sr-only"
                  aria-label={stateLabel(code)}
                />
                <span
                  className="min-w-0 truncate text-[12.5px] font-semibold"
                  style={{ color: "var(--color-dark)" }}
                >
                  <span
                    className="font-heading mr-1.5 inline-block w-[24px] text-[10.5px] uppercase"
                    style={{ color: "var(--color-text-faint)", letterSpacing: ".05em" }}
                  >
                    {code}
                  </span>
                  {stateLabel(code)}
                </span>
              </label>
            );
          })
        )}
      </div>

      {selected.length > 0 && (
        <div
          className="mt-2 text-[11.5px] font-semibold"
          style={{ color: "var(--color-text-muted)" }}
        >
          {selected.length} state{selected.length === 1 ? "" : "s"} selected
        </div>
      )}
    </div>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[13.5px]" style={{ color: "#334155" }}>
        {label}
      </div>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={label}
        className="relative h-[22px] w-10 rounded-full transition-colors"
        style={{ background: value ? "var(--color-dark)" : "#cbd5e1" }}
      >
        <span
          className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all"
          style={{ left: value ? 20 : 2 }}
        />
      </button>
    </div>
  );
}
