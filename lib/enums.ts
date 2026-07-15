/**
 * UI-facing choice lists — one array per Postgres enum in the baseline
 * migration. The `value` field is the exact enum string; the `label`
 * is what the user sees. Keep this file in lockstep with the DB enums.
 */

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
