import { safeExternalUrl, safeImageSrc } from "@/lib/url";
import {
  AGE_BRACKETS,
  COMPETITION_LEVELS,
  EVENT_FEATURES,
  EVENT_REGIONS,
  FIELD_SIZES,
  SURFACES,
  TEAM_GENDERS,
} from "@/lib/enums";

export type AgeGroupInput = {
  team_gender: string;
  age: string;
  price: number;
  field_size: string;
};

export type SponsorInput = {
  name: string;
  link: string;
  logo_url: string;
};

export type MilestoneInput = {
  title: string;
  milestone_date: string;
  description: string;
};

export type EventIntent = "draft" | "publish" | "update";

/** The already-sanitized base fields the field-error rules read. */
export type EventBaseFacts = {
  title: string;
  logo_url: string | null;
  website_url: string | null;
  host_club: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  location_formatted: string | null;
  region: "I" | "II" | "III" | "IV" | null;
  season_id: string | null;
};

/**
 * Sponsor rows with ANY user-entered text. "+ Add sponsor" seeds an
 * all-blank row; treating that scaffolding as a real sponsor made
 * "Save as draft" fail with "sponsor logo is invalid" on forms with no
 * sponsor at all. Blank rows are never validated and never saved.
 */
export function meaningfulSponsors(rows: SponsorInput[]): SponsorInput[] {
  return rows.filter((s) =>
    [s.name, s.link, s.logo_url].some(
      (v) => typeof v === "string" && v.trim() !== "",
    ),
  );
}

/**
 * Pure field-error pass shared by draft/publish/update saves — kept
 * free of DB access so tests can pin the draft-vs-publish rule (the
 * image cap needs a premium peek and stays in the action).
 *
 * Draft requires only a title; publish enforces every mandatory field.
 * Enum cross-checks run for every intent — invalid values are a bug
 * regardless of publish status, and the DB check-constraints would
 * reject them anyway.
 */
export function collectEventFieldErrors({
  intent,
  base,
  ageGroups,
  sponsors,
  levels,
  surfaces,
  features,
}: {
  intent: EventIntent;
  base: EventBaseFacts;
  ageGroups: AgeGroupInput[];
  sponsors: SponsorInput[];
  levels: string[];
  surfaces: string[];
  features: string[];
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!base.title) fieldErrors.title = "Title is required.";

  if (intent === "publish") {
    if (!base.logo_url) fieldErrors.logo_url = "Add a logo to publish.";
    if (!base.website_url) fieldErrors.website_url = "Event website is required.";
    if (!base.host_club) fieldErrors.host_club = "Host club is required.";
    if (!base.start_date) fieldErrors.start_date = "Starting date is required.";
    if (!base.end_date) fieldErrors.end_date = "Ending date is required.";
    if (base.start_date && base.end_date && base.end_date < base.start_date) {
      fieldErrors.end_date = "End date must be on or after the start date.";
    }
    if (!base.description) fieldErrors.description = "Description is required.";
    if (!base.location_formatted)
      fieldErrors.location_formatted = "Location is required.";
    if (!base.region) fieldErrors.region = "Region is required.";
    if (!base.season_id) fieldErrors.season_id = "Season is required.";
    if (levels.length === 0) fieldErrors.competition_levels =
      "Select at least one competition level.";
    if (surfaces.length === 0) fieldErrors.surfaces = "Pick at least one surface.";
  }

  const levelSet = new Set(COMPETITION_LEVELS.map((c) => c.value));
  for (const l of levels) {
    if (!levelSet.has(l as (typeof COMPETITION_LEVELS)[number]["value"])) {
      fieldErrors.competition_levels = "Invalid competition level.";
    }
  }
  const surfaceSet = new Set(SURFACES.map((s) => s.value));
  for (const s of surfaces) {
    if (!surfaceSet.has(s as (typeof SURFACES)[number]["value"])) {
      fieldErrors.surfaces = "Invalid surface.";
    }
  }
  const featureSet = new Set(EVENT_FEATURES.map((f) => f.value));
  for (const f of features) {
    if (!featureSet.has(f as (typeof EVENT_FEATURES)[number]["value"])) {
      fieldErrors.features = "Invalid feature.";
    }
  }
  const regionSet = new Set(EVENT_REGIONS.map((r) => r.value));
  if (base.region && !regionSet.has(base.region)) {
    fieldErrors.region = "Invalid region.";
  }

  for (const g of ageGroups) {
    if (!TEAM_GENDERS.some((t) => t.value === g.team_gender)) {
      fieldErrors.age_groups = "One of your age groups has an invalid gender.";
    }
    if (
      !(AGE_BRACKETS as readonly string[]).includes(g.age)
    ) {
      fieldErrors.age_groups = "One of your age groups has an invalid age.";
    }
    if (!Number.isFinite(g.price) || g.price < 0 || g.price > 100000) {
      fieldErrors.age_groups = "Age-group prices must be positive whole numbers.";
    }
    if (!(FIELD_SIZES as readonly string[]).includes(g.field_size)) {
      fieldErrors.age_groups = "One of your age groups has an invalid field size.";
    }
  }

  // Sponsors gate the LIVE surface only: publish AND update (the
  // intents that put/keep an event public) require complete rows with
  // safe URLs. A draft saves whatever is in progress — the draft rule
  // is "only a title is mandatory" — and blank scaffold rows never
  // validate for any intent.
  if (intent !== "draft") {
    for (const s of meaningfulSponsors(sponsors)) {
      // First failing rule wins per row — an incomplete row reads as
      // "fill it in", not as a bogus "invalid logo" on an empty field.
      if (!s.name?.trim() || !s.link?.trim() || !s.logo_url?.trim()) {
        fieldErrors.sponsors = "Each sponsor needs a name, link, and logo URL.";
      } else if (safeExternalUrl(s.link) === null) {
        fieldErrors.sponsors = "One of your sponsor links is invalid.";
      } else if (safeImageSrc(s.logo_url) === null) {
        fieldErrors.sponsors = "One of your sponsor logos is invalid.";
      }
    }
  }

  return fieldErrors;
}
