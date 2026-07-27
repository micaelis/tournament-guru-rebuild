import type { IconName } from "@/app/dashboard/icons";

/**
 * Presentational FAQ topics (S12.43). The schema has no topic column —
 * admins author flat entries targeted by audience — so the dashboard
 * FAQ page buckets entries into the four canonical help topics by
 * TITLE keywords. Title-only on purpose: a question's title is its
 * subject, while answer bodies routinely mention events/reviews in
 * passing and would misfile everything they touch. Unmatched titles
 * land in "Getting started". Empty topics never render, so a
 * mis-bucketed entry is at worst one section off — never lost.
 */
export type FaqTopicId = "start" | "reviews" | "events" | "account";

export type FaqTopic = {
  id: FaqTopicId;
  label: string;
  blurb: string;
  icon: IconName;
  /** The reviews topic wears the red-tinted badge (Guru = red). */
  accent?: boolean;
};

export const FAQ_TOPICS: readonly FaqTopic[] = [
  {
    id: "start",
    label: "Getting started",
    blurb: "Finding your way around Tournament Guru.",
    icon: "compass",
  },
  {
    id: "reviews",
    label: "Reviews & ratings",
    blurb: "How reviews are written, verified, and scored.",
    icon: "star",
    accent: true,
  },
  {
    id: "events",
    label: "Events & claiming",
    blurb: "Listings, ownership, and Premium placement.",
    icon: "calendar",
  },
  {
    id: "account",
    label: "Account & privacy",
    blurb: "Your data, your login, and what others can see.",
    icon: "shield",
  },
] as const;

// Priority order: account before reviews so "…my reviews if I delete my
// account?" files under Account & privacy; reviews before events so
// "Can a director remove my review?" stays with reviews. "tournament"
// and "guru" are deliberately NOT keywords — both live in the brand
// name ("What is Tournament Guru?" must fall through to Getting
// started); the GURU-review question still files via "verified" /
// "reviews".
const ACCOUNT_RE =
  /\b(email|password|account|privacy|private|profile|notification|log ?in|sign ?in)\b/i;
const REVIEWS_RE = /\b(reviews?|ratings?|verified|stars?|scores?)\b/i;
const EVENTS_RE =
  /\b(events?|claim(?:ing|ed)?|premium|list(?:ed|ing)s?|spotlight|directors?|sponsors?)\b/i;

export function deriveFaqTopic(title: string): FaqTopicId {
  if (ACCOUNT_RE.test(title)) return "account";
  if (REVIEWS_RE.test(title)) return "reviews";
  if (EVENTS_RE.test(title)) return "events";
  return "start";
}
