import { MIN_AGE_YEARS } from "./enums";

/**
 * Password rule per the Auth & Onboarding spec (signup section):
 * 8 chars minimum, at least one uppercase, at least one digit. Server-
 * side authoritative — even if the client already checked.
 */
export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw)) return "Password needs at least one uppercase letter.";
  if (!/\d/.test(pw)) return "Password needs at least one number.";
  return null;
}

/**
 * Loose but useful email pattern. We rely on Supabase for the actual
 * validation on signup — this is just to catch obvious typos before
 * we spend a round trip.
 */
export function validateEmail(email: string): string | null {
  if (!email) return "Email is required.";
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "That doesn't look like a valid email address.";
  }
  return null;
}

/**
 * Age check for onboarding step 2. Returns true when the DOB puts the
 * user at least MIN_AGE_YEARS old on the current date. Under-18s are
 * blocked from proceeding (spec: "If the user is a minor - display
 * simple warning and don't allow to proceed").
 */
export function isAdultDob(dobIso: string, today: Date = new Date()): boolean {
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return false;
  const cutoff = new Date(today);
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
  return dob <= cutoff;
}
