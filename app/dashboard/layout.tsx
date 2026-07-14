import { TGLogo } from "@/app/components/TGLogo";
import {
  DashboardMobileMenu,
  DashboardSidebar,
  UserChip,
  type NavGroup,
} from "./parts";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import type { DashboardProfile } from "@/lib/supabase/session";

/**
 * Internal chrome for /dashboard/**.
 *
 * Server-side role gate: mirrors the Bubble page's role-conditional sidebar
 * (Admin container / Event Director container / Attendee "customer" page), but
 * decisions are made HERE — RLS then enforces the same partition at the data
 * layer, so a wrong-role user with a hand-crafted URL sees nothing anyway.
 *
 * Company falls back to the Attendee sidebar for now — no Company-specific
 * bubble section exists yet.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireSessionAndProfile();
  const groups = navGroupsFor(profile);

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: "var(--color-surface)" }}
    >
      <header
        className="sticky top-0 z-40 flex items-center justify-between"
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--color-border)",
          padding: "10px 20px",
        }}
      >
        <div className="flex items-center gap-3">
          <DashboardMobileMenu groups={groups} profile={profile} />
          <TGLogo href="/dashboard" size="sm" />
        </div>
        <UserChip profile={profile} />
      </header>

      <div className="flex flex-1">
        <DashboardSidebar groups={groups} />
        <main className="flex-1 min-w-0">
          <div
            className="mx-auto w-full"
            style={{ maxWidth: 1180, padding: "28px clamp(16px, 3vw, 32px)" }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Build the sidebar for a role. Kept out of the client bundle so the nav model
 * itself never travels with items the current user isn't permitted to see.
 */
function navGroupsFor(profile: DashboardProfile): NavGroup[] {
  const role = profile.user_type;

  if (role === "admin") {
    return [
      {
        items: [
          { label: "Events", href: "/dashboard/events", icon: "events" },
          { label: "Reviews", href: "/dashboard/reviews", icon: "reviews" },
          { label: "Find Events", href: "/events", icon: "find" },
        ],
      },
      {
        title: "Admin",
        items: [
          { label: "Users", href: "/dashboard/users", icon: "users" },
          { label: "Cuss Words", href: "/dashboard/cuss-words", icon: "cuss" },
          { label: "Flagged Content", href: "/dashboard/flagged", icon: "flagged" },
          { label: "Contact Requests", href: "/dashboard/contact-requests", icon: "contact" },
        ],
      },
      {
        items: [
          { label: "Claim Requests", href: "/dashboard/claim-requests", icon: "claim" },
          { label: "Promo Codes", href: "/dashboard/promo-codes", icon: "promo" },
          { label: "Account", href: "/dashboard/account", icon: "account" },
          { label: "FAQ", href: "/dashboard/faq", icon: "faq" },
        ],
      },
    ];
  }

  if (role === "event_director") {
    return [
      {
        items: [
          { label: "Events", href: "/dashboard/events", icon: "events" },
          { label: "Reviews", href: "/dashboard/reviews", icon: "reviews" },
          { label: "Find Events", href: "/events", icon: "find" },
          { label: "Claim Requests", href: "/dashboard/claim-requests", icon: "claim" },
          { label: "Promo Codes", href: "/dashboard/promo-codes", icon: "promo" },
        ],
      },
      {
        title: "Event Director",
        items: [
          { label: "Transactions", href: "/dashboard/transactions", icon: "transactions" },
          { label: "Notifications", href: "/dashboard/notifications", icon: "notifications" },
          { label: "Add-on Pricing", href: "/dashboard/add-on-pricing", icon: "addon" },
        ],
      },
      {
        items: [
          { label: "Account", href: "/dashboard/account", icon: "account" },
          { label: "Support", href: "/dashboard/support", icon: "support" },
          { label: "FAQ", href: "/dashboard/faq", icon: "faq" },
        ],
      },
    ];
  }

  // attendee + company: mirrors Bubble's "customer" page — no admin/ED items.
  return [
    {
      items: [
        { label: "Favorite Events", href: "/dashboard/favorites", icon: "favorites" },
        { label: "Find Events", href: "/events", icon: "find" },
        { label: "Reviews", href: "/dashboard/reviews", icon: "reviews" },
        { label: "Notifications", href: "/dashboard/notifications", icon: "notifications" },
      ],
    },
    {
      items: [
        { label: "Account", href: "/dashboard/account", icon: "account" },
        { label: "Support", href: "/dashboard/support", icon: "support" },
        { label: "FAQ", href: "/dashboard/faq", icon: "faq" },
      ],
    },
  ];
}
