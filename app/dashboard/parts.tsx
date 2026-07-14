"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import type { DashboardProfile } from "@/lib/supabase/session";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

export type NavGroup = {
  /** Section header shown above the group; omit for the top group. */
  title?: string;
  items: NavItem[];
};

/**
 * The Bubble dashboard grouped its role-scoped items under labeled buckets
 * ("Admin", "Event Director"). Rendered the same way here — the layout picks
 * which groups to pass based on user_type, so nothing about the other role
 * ever reaches the client.
 */
export function DashboardSidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0"
      style={{
        width: 244,
        borderRight: "1px solid var(--color-border)",
        background: "#fff",
        padding: "20px 14px 24px",
      }}
    >
      <nav className="flex flex-col gap-6">
        {groups.map((group, i) => (
          <div key={group.title ?? `top-${i}`} className="flex flex-col gap-1">
            {group.title && (
              <div
                className="font-heading uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: ".14em",
                  color: "var(--color-text-faint)",
                  padding: "6px 10px 4px",
                }}
              >
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return <SideLink key={item.href} item={item} active={active} />;
            })}
          </div>
        ))}
      </nav>

      <form action={signOut} className="mt-auto pt-6">
        <button
          type="submit"
          className="tg-hover flex w-full items-center gap-2 rounded-lg text-left"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            background: "transparent",
            border: 0,
            padding: "10px 12px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Icon name="logout" />
          Log out
        </button>
      </form>
    </aside>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className="tg-hover flex items-center gap-2 rounded-lg"
      style={{
        fontSize: 13.5,
        fontWeight: active ? 700 : 600,
        color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
        background: active ? "rgba(220,38,38,.08)" : "transparent",
        textDecoration: "none",
        padding: "9px 12px",
      }}
    >
      <Icon name={item.icon} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/* ── Mobile top-bar drawer trigger ── */

export function DashboardMobileMenu({
  groups,
  profile,
}: {
  groups: NavGroup[];
  profile: DashboardProfile;
}) {
  // Kept intentionally minimal for Step 1: a details/summary disclosure so
  // the sidebar is reachable on narrow screens without pulling in state,
  // click-outside handlers, or focus management yet. We'll upgrade when we
  // add sections that make the mobile experience matter.
  return (
    <details className="lg:hidden">
      <summary
        className="tg-hover flex cursor-pointer items-center justify-center rounded-lg list-none"
        style={{
          width: 40,
          height: 40,
          border: "1px solid var(--color-border)",
          background: "#fff",
          color: "var(--color-dark)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <div
        className="fixed inset-x-0 z-40 mx-3 mt-2 rounded-2xl"
        style={{
          background: "#fff",
          border: "1px solid var(--color-border)",
          boxShadow: "0 18px 40px -18px rgba(15,23,42,.28)",
          padding: 12,
        }}
      >
        <div
          className="mb-2 flex items-center gap-2 rounded-lg"
          style={{ padding: "8px 10px", background: "var(--color-surface-alt)" }}
        >
          <UserChip profile={profile} />
        </div>
        {groups.map((group, i) => (
          <div key={group.title ?? `top-${i}`} className="mt-2">
            {group.title && (
              <div
                className="font-heading uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: ".14em",
                  color: "var(--color-text-faint)",
                  padding: "8px 10px 4px",
                }}
              >
                {group.title}
              </div>
            )}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="tg-hover flex items-center gap-2 rounded-lg"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-dark)",
                  textDecoration: "none",
                  padding: "10px 12px",
                }}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="tg-hover flex w-full items-center gap-2 rounded-lg"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              background: "transparent",
              border: 0,
              padding: "10px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Icon name="logout" />
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}

/* ── User chip (top-bar + mobile drawer header) ── */

export function UserChip({ profile }: { profile: DashboardProfile }) {
  const label = displayName(profile);
  const initial = (label || "?").trim().charAt(0).toUpperCase();
  const roleLabel = ROLE_LABEL[profile.user_type];

  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{
          width: 32,
          height: 32,
          fontSize: 13,
          background:
            "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
        }}
      >
        {initial}
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span
          className="truncate"
          style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-dark)" }}
        >
          {label}
        </span>
        <span
          className="font-heading truncate uppercase"
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".12em",
            color: "var(--color-text-faint)",
          }}
        >
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

function displayName(p: DashboardProfile): string {
  if (p.full_name && p.full_name.trim()) return p.full_name.trim();
  if (p.contact_email) return p.contact_email;
  return "Account";
}

const ROLE_LABEL: Record<DashboardProfile["user_type"], string> = {
  admin: "Admin",
  event_director: "Event Director",
  attendee: "Attendee",
  company: "Company",
};

/* ── Icons (inline SVG so the sidebar stays self-contained) ── */

type IconName =
  | "events"
  | "reviews"
  | "find"
  | "users"
  | "cuss"
  | "flagged"
  | "contact"
  | "claim"
  | "promo"
  | "transactions"
  | "notifications"
  | "addon"
  | "account"
  | "favorites"
  | "support"
  | "faq"
  | "logout";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "events":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "reviews":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "find":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "cuss":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 15 8-6M9 9h.01M15 15h.01" />
        </svg>
      );
    case "flagged":
      return (
        <svg {...common}>
          <path d="M4 22V4a1 1 0 0 1 1-1h14l-3 5 3 5H5" />
        </svg>
      );
    case "contact":
      return (
        <svg {...common}>
          <path d="M4 4h16v12H5.6L4 18V4z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
      );
    case "claim":
      return (
        <svg {...common}>
          <path d="M12 22s-8-4.5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-8 11-8 11z" strokeWidth="1.5" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "promo":
      return (
        <svg {...common}>
          <path d="M20.6 12 12 3.4H4v8L12.6 20a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8z" />
          <circle cx="7.5" cy="7.5" r="1.5" />
        </svg>
      );
    case "transactions":
      return (
        <svg {...common}>
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      );
    case "addon":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "account":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "favorites":
      return (
        <svg {...common}>
          <path d="m12 21-1.5-1.4C5 14.6 2 12 2 8.5A5.5 5.5 0 0 1 7.5 3a5.5 5.5 0 0 1 4.5 2.3A5.5 5.5 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.5-3 6.1-8.5 11.1z" />
        </svg>
      );
    case "support":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01" />
        </svg>
      );
    case "faq":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
        </svg>
      );
  }
}
