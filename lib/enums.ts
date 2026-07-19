/**
 * UI-facing choice lists — one array per Postgres enum in the baseline
 * migration. The `value` field is the exact enum string; the `label`
 * is what the user sees. Keep this file in lockstep with the DB enums.
 */

/**
 * Narrow a raw form/query string to one of an enum's values. Returns
 * null for absent OR unknown input — callers that must distinguish
 * "tampered" from "blank" compare against the raw string they passed.
 * This is the bridge from untyped FormData to the generated Database
 * enum unions (no casts).
 */
export function enumOrNull<T extends string>(
  values: readonly T[],
  raw: string | null | undefined,
): T | null {
  return values.find((v) => v === raw) ?? null;
}

export const USER_TYPES = [
  { value: "attendee", label: "I'm looking for events" },
  { value: "event_director", label: "I run events" },
] as const;

export type UserTypeValue = (typeof USER_TYPES)[number]["value"];

export const ATTENDEE_ROLES = [
  { value: "coach", label: "Coach" },
  { value: "team_manager", label: "Team Manager" },
  { value: "parent_spectator", label: "Parent / Spectator" },
] as const;

export const ED_ROLES = [
  { value: "event_director", label: "Event Director" },
  { value: "event_admin", label: "Event Admin" },
  { value: "club_director", label: "Club Director" },
] as const;

export type RoleValue =
  | (typeof ATTENDEE_ROLES)[number]["value"]
  | (typeof ED_ROLES)[number]["value"];

export function rolesFor(userType: UserTypeValue) {
  return userType === "event_director" ? ED_ROLES : ATTENDEE_ROLES;
}

// role_title values that do NOT require organization_title.
export const ORG_OPTIONAL_ROLES = new Set(["parent_spectator"]);

export const USER_GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

export const DISTANCE_PREFS = [
  { value: "no_limit", label: "No limit" },
  { value: "miles_150", label: "< 150 miles" },
  { value: "miles_300", label: "< 300 miles" },
  { value: "miles_450", label: "< 450 miles" },
] as const;

export const TEAM_GENDERS = [
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "both", label: "Both" },
] as const;

export const AGE_BRACKETS = [
  "U4", "U5", "U6", "U7", "U8", "U9", "U10", "U11", "U12",
  "U13", "U14", "U15", "U16", "U17", "U18", "U19", "U20",
] as const;

export const COMPETITION_LEVELS = [
  { value: "highest", label: "Highest" },
  { value: "upper", label: "Upper" },
  { value: "middle", label: "Middle" },
  { value: "lower", label: "Lower" },
  { value: "lowest", label: "Lowest" },
] as const;

/**
 * Minimum-age gate. The Auth spec says under-18s are blocked at
 * signup/onboarding. Kept as a single constant so it's grep-able.
 */
export const MIN_AGE_YEARS = 18;

export const EVENT_REGIONS = [
  { value: "I", label: "Region I" },
  { value: "II", label: "Region II" },
  { value: "III", label: "Region III" },
  { value: "IV", label: "Region IV" },
] as const;

export type EventRegion = (typeof EVENT_REGIONS)[number]["value"];

export const SURFACES = [
  { value: "turf", label: "Turf" },
  { value: "grass", label: "Grass" },
] as const;

export const FIELD_SIZES = [
  "5v5",
  "6v6",
  "7v7",
  "8v8",
  "9v9",
  "10v10",
  "11v11",
] as const;

export const EVENT_FEATURES = [
  { value: "stay_to_play", label: "Stay to Play" },
  { value: "restrooms", label: "Restrooms" },
  { value: "concessions", label: "Concessions" },
  { value: "accessible", label: "Accessible" },
  { value: "free_wifi", label: "Free Wifi" },
  { value: "pet_friendly", label: "Pet Friendly" },
  { value: "free_parking", label: "Free Parking" },
  { value: "synthetic_turf", label: "Synthetic Turf" },
] as const;

/** Non-premium images cap. Premium unlocks 10 more (13 total). */
export const FREE_IMAGE_LIMIT = 3;
export const PREMIUM_IMAGE_LIMIT = 13;

/** Cancel-reason character cap — displayed publicly, so keep it short. */
export const CANCEL_REASON_MAX = 500;

