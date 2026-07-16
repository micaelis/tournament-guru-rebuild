/* taxonomy.ts — display labels, canonical ordering, and URL (de)serialization
   for the Find Events filters. Enum *values* stay lowercase (u12, boys, upper,
   turf) to match the DB; labels are derived here so the UI reads cleanly.
   Shared by the server page and the client filter UI — no "use client". */

import type { EventFacets, EventSort } from "@/app/components/types";

export type Filters = {
  q: string;
  ages: string[];
  genders: string[];
  levels: string[];
  surfaces: string[];
  /** 2-letter US state codes ("CA", "NY", …). Replaces the earlier NCAA-style
   *  "regions" (I/II/III/IV) — states are what the ED brief calls out and what
   *  actually lives on events.state. */
  states: string[];
  dateStart: string;
  dateEnd: string;
  openOnly: boolean;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  ages: [],
  genders: [],
  levels: [],
  surfaces: [],
  states: [],
  dateStart: "",
  dateEnd: "",
  openOnly: false,
};

/* ── Canonical orderings (enum domains) ── */
const AGE_ORDER = ["u4","u5","u6","u7","u8","u9","u10","u11","u12","u13","u14","u15","u16","u17","u18","u19","u20"];
const GENDER_ORDER = ["boys", "girls", "both"];
const LEVEL_ORDER = ["highest", "upper", "middle", "lower", "lowest"];
const SURFACE_ORDER = ["grass", "turf"];

/** All 50 US states + DC, canonical alphabetical order for the UI. Anything
 *  extra the DB might expose (territories, e.g.) will be appended by
 *  `fullDomain` so nothing real is dropped. */
export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];
const STATE_ORDER = US_STATES.map((s) => s.code);
const STATE_NAME_BY_CODE = Object.fromEntries(US_STATES.map((s) => [s.code, s.name]));

/** Franco's brief: "Sort by, needs to replace RECOMMENDED with 'Most Teams'".
 *  Kept old values in the type so existing bookmarked URLs still land somewhere
 *  sensible, but "Most Teams" is now the primary/default order. */
export const SORT_OPTIONS: { value: EventSort; label: string }[] = [
  { value: "teams", label: "Most teams" },
  { value: "date", label: "Date · soonest" },
  { value: "rating", label: "Highest rated" },
];

export const DEFAULT_SORT: EventSort = "teams";

/* ── Label helpers ── */
export function ageLabel(v: string) {
  return v.toUpperCase();
}
export function genderLabel(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}
export function surfaceLabel(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export const LEVEL_META: Record<string, { label: string; desc: string }> = {
  highest: { label: "Highest", desc: "ECNL, MLS Next, national champions" },
  upper: { label: "Upper", desc: "State cup contenders, top regional clubs" },
  middle: { label: "Middle", desc: "Competitive club & travel teams" },
  lower: { label: "Lower", desc: "Recreational, U-Little, first-timer friendly" },
  lowest: { label: "Lowest", desc: "Developmental & introductory play" },
};
export function levelLabel(v: string) {
  return LEVEL_META[v]?.label ?? v;
}

/** "CA" → "California". Unknown / non-US codes pass through so nothing renders
 *  as blank. */
export function stateLabel(code: string): string {
  return STATE_NAME_BY_CODE[code] ?? code;
}
/** Compact "CA" for chips / summaries. */
export function stateShort(code: string): string {
  return code.toUpperCase();
}

/* ── Ordered filter option lists, built from the real facets ── */
export type FilterOptions = {
  ages: string[];
  genders: string[];
  levels: string[];
  surfaces: string[];
  /** All 50 US states + DC in alphabetical order, followed by any extra values
   *  the DB happens to expose (territories, etc). */
  states: string[];
};

/* Always show the full enum domain so every filter chip is visible — the bar
   should read as "fully customisable" even before every value has events
   behind it. Any real facet value outside the canonical order is appended
   (future-proofing), so nothing real is ever dropped. */
function fullDomain(values: string[], order: string[]): string[] {
  const extra = values.filter((v) => !order.includes(v));
  return [...order, ...extra];
}

export function buildFilterOptions(facets: EventFacets): FilterOptions {
  return {
    ages: fullDomain(facets.ages, AGE_ORDER),
    genders: fullDomain(facets.genders, GENDER_ORDER),
    levels: fullDomain(facets.levels, LEVEL_ORDER),
    surfaces: fullDomain(facets.surfaces, SURFACE_ORDER),
    states: fullDomain((facets.states ?? []).map((s) => s.toUpperCase()), STATE_ORDER),
  };
}

/* ── URL (de)serialization ── */
export function filtersToQuery(
  f: Filters,
  sort: EventSort,
  page: number
): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.ages.length) p.set("ages", f.ages.join(","));
  if (f.genders.length) p.set("genders", f.genders.join(","));
  if (f.levels.length) p.set("levels", f.levels.join(","));
  if (f.surfaces.length) p.set("surfaces", f.surfaces.join(","));
  if (f.states.length) p.set("states", f.states.join(","));
  if (f.dateStart) p.set("dateStart", f.dateStart);
  if (f.dateEnd) p.set("dateEnd", f.dateEnd);
  if (f.openOnly) p.set("open", "1");
  if (sort !== DEFAULT_SORT) p.set("sort", sort);
  if (page > 1) p.set("page", String(page));
  return p;
}

type RawParams = Record<string, string | string[] | undefined>;
function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}
function csv(v: string | string[] | undefined): string[] {
  const s = one(v);
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

export function parseSearchParams(sp: RawParams): {
  filters: Filters;
  sort: EventSort;
  page: number;
} {
  const sortRaw = one(sp.sort);
  // Accept the historical "recommended" URL value so old bookmarks don't 404 —
  // it silently maps to the new default (Most teams).
  const validSorts: EventSort[] = ["recommended", "date", "rating", "teams"];
  const sort: EventSort =
    validSorts.includes(sortRaw as EventSort) && sortRaw !== "recommended"
      ? (sortRaw as EventSort)
      : DEFAULT_SORT;
  const page = Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);

  // "regions" is the legacy URL key; keep reading it as if it were "states" so
  // shared/bookmarked links from the old scheme still land on a working page.
  const statesFromNew = csv(sp.states);
  const statesFromLegacy = csv(sp.regions).map((s) => s.toUpperCase());
  const states = statesFromNew.length ? statesFromNew.map((s) => s.toUpperCase()) : statesFromLegacy;

  return {
    filters: {
      q: one(sp.q),
      ages: csv(sp.ages),
      genders: csv(sp.genders),
      levels: csv(sp.levels),
      surfaces: csv(sp.surfaces),
      states,
      dateStart: one(sp.dateStart),
      dateEnd: one(sp.dateEnd),
      openOnly: one(sp.open) === "1",
    },
    sort,
    page,
  };
}

export function countActiveFilters(f: Filters): number {
  return (
    (f.dateStart || f.dateEnd ? 1 : 0) +
    f.ages.length +
    f.genders.length +
    f.levels.length +
    f.surfaces.length +
    f.states.length +
    (f.openOnly ? 1 : 0)
  );
}

export function summarize(values: string[], label: (v: string) => string): string | null {
  if (!values.length) return null;
  if (values.length === 1) return label(values[0]);
  if (values.length === 2) return values.map(label).join(", ");
  return `${label(values[0])} +${values.length - 1}`;
}
