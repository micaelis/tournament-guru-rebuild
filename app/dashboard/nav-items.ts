import type { Route } from "next";

export type NavItem = {
  href: Route;
  label: string;
  section?: string;
};

/**
 * Nav items per role. Kept as static arrays because the sidebar has no
 * per-user overrides in this sprint.
 */
export const ATTENDEE_NAV: NavItem[] = [
  { href: "/events" as Route, label: "Search Events", section: "Browse" },
  { href: "/dashboard/reviews" as Route, label: "My Reviews", section: "You" },
  { href: "/dashboard/promo-codes" as Route, label: "Promo Codes", section: "You" },
  { href: "/dashboard/favorites" as Route, label: "Favorites", section: "You" },
  { href: "/dashboard/activity" as Route, label: "Activity", section: "You" },
  { href: "/dashboard/account" as Route, label: "Account", section: "You" },
  { href: "/dashboard/support" as Route, label: "Support", section: "You" },
];

export const ED_NAV: NavItem[] = [
  { href: "/dashboard/events" as Route, label: "Events", section: "Manage" },
  { href: "/dashboard/reviews" as Route, label: "Reviews", section: "Manage" },
  { href: "/dashboard/claim-requests" as Route, label: "Claim Requests", section: "Manage" },
  { href: "/dashboard/promo-codes" as Route, label: "Promo Codes", section: "Manage" },
  { href: "/events" as Route, label: "Search Events", section: "Browse" },
  { href: "/dashboard/account" as Route, label: "Account", section: "You" },
  { href: "/dashboard/support" as Route, label: "Support", section: "You" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard/events" as Route, label: "Events", section: "Content" },
  { href: "/dashboard/reviews" as Route, label: "Reviews", section: "Content" },
  { href: "/dashboard/flagged" as Route, label: "Flagged", section: "Content" },
  { href: "/dashboard/banned-words" as Route, label: "Banned Words", section: "Content" },
  { href: "/dashboard/faqs" as Route, label: "FAQs", section: "Content" },
  { href: "/dashboard/users" as Route, label: "Users", section: "People" },
  { href: "/dashboard/claim-requests" as Route, label: "Claim Requests", section: "People" },
  { href: "/dashboard/promo-codes" as Route, label: "Promo Codes", section: "People" },
  { href: "/dashboard/support-messages" as Route, label: "Support Messages", section: "People" },
  { href: "/events" as Route, label: "Search Events", section: "Browse" },
  { href: "/dashboard/account" as Route, label: "Account", section: "You" },
];

export function navFor(userType: "attendee" | "event_director" | "admin"): NavItem[] {
  if (userType === "admin") return ADMIN_NAV;
  if (userType === "event_director") return ED_NAV;
  return ATTENDEE_NAV;
}
