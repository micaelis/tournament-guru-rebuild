import type { Route } from "next";
import type { IconName } from "./icons";

export type NavItem = {
  href: Route;
  label: string;
  section?: string;
  icon: IconName;
};

/**
 * Nav items per role. Kept as static arrays because the sidebar has no
 * per-user overrides in this sprint.
 */
export const ATTENDEE_NAV: NavItem[] = [
  { href: "/events" as Route, label: "Search Events", section: "Browse", icon: "search" },
  { href: "/dashboard/reviews" as Route, label: "My Reviews", section: "You", icon: "star" },
  { href: "/dashboard/promo-codes" as Route, label: "Promo Codes", section: "You", icon: "tag" },
  { href: "/dashboard/favorites" as Route, label: "Favorites", section: "You", icon: "heart" },
  { href: "/dashboard/activity" as Route, label: "Activity", section: "You", icon: "activity" },
  { href: "/dashboard/account" as Route, label: "Account", section: "You", icon: "user" },
  { href: "/dashboard/faq" as Route, label: "FAQ", section: "You", icon: "help" },
  { href: "/dashboard/support" as Route, label: "Support", section: "You", icon: "lifebuoy" },
];

export const ED_NAV: NavItem[] = [
  { href: "/dashboard/events" as Route, label: "Events", section: "Manage", icon: "calendar" },
  { href: "/dashboard/reviews" as Route, label: "Reviews", section: "Manage", icon: "star" },
  { href: "/dashboard/claim-requests" as Route, label: "Claim Requests", section: "Manage", icon: "inbox" },
  { href: "/dashboard/promo-codes" as Route, label: "Promo Codes", section: "Manage", icon: "tag" },
  { href: "/events" as Route, label: "Search Events", section: "Browse", icon: "search" },
  { href: "/dashboard/account" as Route, label: "Account", section: "You", icon: "user" },
  { href: "/dashboard/faq" as Route, label: "FAQ", section: "You", icon: "help" },
  { href: "/dashboard/support" as Route, label: "Support", section: "You", icon: "lifebuoy" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard/events" as Route, label: "Events", section: "Content", icon: "calendar" },
  { href: "/dashboard/reviews" as Route, label: "Reviews", section: "Content", icon: "star" },
  { href: "/dashboard/flagged" as Route, label: "Flagged", section: "Content", icon: "flag" },
  { href: "/dashboard/banned-words" as Route, label: "Banned Words", section: "Content", icon: "shield" },
  { href: "/dashboard/faqs" as Route, label: "FAQs", section: "Content", icon: "help" },
  { href: "/dashboard/users" as Route, label: "Users", section: "People", icon: "users" },
  { href: "/dashboard/claim-requests" as Route, label: "Claim Requests", section: "People", icon: "inbox" },
  { href: "/dashboard/promo-codes" as Route, label: "Promo Codes", section: "People", icon: "tag" },
  { href: "/dashboard/support-messages" as Route, label: "Support Messages", section: "People", icon: "mail" },
  { href: "/events" as Route, label: "Search Events", section: "Browse", icon: "search" },
  { href: "/dashboard/account" as Route, label: "Account", section: "You", icon: "user" },
];

export function navFor(userType: "attendee" | "event_director" | "admin"): NavItem[] {
  if (userType === "admin") return ADMIN_NAV;
  if (userType === "event_director") return ED_NAV;
  return ATTENDEE_NAV;
}
