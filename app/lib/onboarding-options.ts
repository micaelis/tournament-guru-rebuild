/**
 * Dropdown / choice values for auth + onboarding.
 *
 * Each list mirrors a Postgres enum defined in docs/schema.sql VERBATIM — the
 * `value` is exactly what gets stored, the `label` is what the user sees. Keep
 * this file and the DB enums in lockstep.
 */

// customer_type — profiles.attendee_type
export const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "parent_spectator", label: "Parent / Spectator" },
  { value: "team_manager", label: "Team Manager" },
] as const;

// Roles that see the organisation-name field. Bubble showed it to coaches +
// team managers; parents/spectators also see it here (many affiliate with a
// club or team). It's *required* only for team_manager — see ORG_REQUIRED.
export const ORG_ROLES = [
  "coach",
  "parent_spectator",
  "team_manager",
] as const;

export const ORG_REQUIRED = ["team_manager"] as const;

// user_gender — profiles.gender
export const USER_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

// distance_pref — profiles.pref_distance. Labels match Bubble's Distance
// option set ("<150 miles" etc.) verbatim.
export const DISTANCE_OPTIONS = [
  { value: "no_limit", label: "No limit" },
  { value: "lt_150", label: "<150 miles" },
  { value: "lt_300", label: "<300 miles" },
  { value: "lt_450", label: "<450 miles" },
] as const;

// competition_level — user_teams.level, profiles.pref_competition. Labels
// AND left-to-right order match Bubble's Competition Level onboarding pills
// verbatim ("Highest → Lowest").
export const COMPETITION_LEVEL_OPTIONS = [
  { value: "highest", label: "Highest" },
  { value: "upper", label: "Upper" },
  { value: "middle", label: "Middle" },
  { value: "lower", label: "Lower" },
  { value: "lowest", label: "Lowest" },
] as const;

// gender — user_teams.gender (team make-up). Labels match Bubble's Gender
// option set: "Boys" / "Girls" / "Both".
export const TEAM_GENDER_OPTIONS = [
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "both", label: "Both" },
] as const;

// age_group — user_teams.age (u4 … u20)
export const AGE_OPTIONS = Array.from({ length: 17 }, (_, i) => {
  const n = i + 4; // u4 through u20
  return { value: `u${n}`, label: `U${n}` };
}) as { value: string; label: string }[];

// ── Value sets for server-side validation ──
export const ROLE_VALUES = ROLE_OPTIONS.map((o) => o.value) as string[];
export const USER_GENDER_VALUES = USER_GENDER_OPTIONS.map((o) => o.value) as string[];
export const DISTANCE_VALUES = DISTANCE_OPTIONS.map((o) => o.value) as string[];
export const COMPETITION_LEVEL_VALUES = COMPETITION_LEVEL_OPTIONS.map((o) => o.value) as string[];
export const TEAM_GENDER_VALUES = TEAM_GENDER_OPTIONS.map((o) => o.value) as string[];
export const AGE_VALUES = AGE_OPTIONS.map((o) => o.value);
