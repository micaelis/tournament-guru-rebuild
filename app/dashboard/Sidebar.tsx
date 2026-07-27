"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SafeImg } from "@/app/components/ui/SafeImg";
import { cn } from "@/app/components/ui/cn";
import { safeImageSrc } from "@/lib/url";
import { Icon } from "./icons";
import type { NavItem } from "./nav-items";

/**
 * The ink navigation rail. Identity + sign-out live in the top header's
 * user menu — the rail's bottom slot instead carries role context: EDs
 * get the Premium-listings pointer and their organization card;
 * attendees get their club card (when they have one); admins get
 * neither.
 */
export function Sidebar({
  items,
  userType,
  orgTitle,
  orgLogoUrl,
}: {
  items: NavItem[];
  userType: "attendee" | "event_director" | "admin";
  orgTitle: string | null;
  orgLogoUrl: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = groupBySection(items);
  const isEd = userType === "event_director";
  const showOrgCard = isEd || (userType === "attendee" && Boolean(orgTitle));
  // Covers both add-ons surfaces: /dashboard/add-ons and the
  // event-scoped /dashboard/events/[id]/add-ons.
  const onAddOnsPage =
    pathname === "/dashboard/add-ons" || pathname.endsWith("/add-ons");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3 z-40 grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm md:hidden"
        aria-label="Open menu"
      >
        <span className="block h-0.5 w-5 rounded bg-slate-800" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden",
          open ? "block" : "hidden",
        )}
        onClick={() => setOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[var(--color-dark)] transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo — the real mark from public/logo.svg (wordmark rows cropped
            out), swoosh inverted white for the ink rail, star + T keeping
            the logo's own reds. Mirrors design/account-redesign.html. */}
        <div className="flex items-center justify-between px-5 py-6">
          <Link href={"/" as never} className="flex items-center gap-3">
            {/* Decorative: the wordmark text beside it names the link. */}
            <svg viewBox="0 0 295.82 141" className="h-8 w-auto" aria-hidden="true">
              <path
                fill="#ffffff"
                d="M264.28,47.3c0.12,1.75,0.19,3.52,0.19,5.31c0,12.32-2.83,23.67-7.6,32.79c-1.13,2.38-2.56,4.66-4.24,6.82c-4.18,5.7-9.26,10.03-14.9,12.49c-9.69,5.44-21.84,8.69-35.04,8.69c-0.7,0-1.4-0.02-2.09-0.04c-0.69,0.02-1.39,0.04-2.09,0.04c-31.66,0-57.33-18.64-57.33-41.63c0-22.99,25.67-41.63,57.33-41.63h54.61h9.61c4.35-0.05,4.35-0.05,4.35-0.05c1.64-1.16,3.37-3.12,5.5-5.58l23.22-24.42H201.8c-51.93,0-94.02,31.93-94.02,71.33s42.09,71.33,94.02,71.33s94.02-31.93,94.02-71.33c0-2.7-0.22-5.36-0.61-7.99L264.28,47.3z"
              />
              <polygon
                fill="#EC2027"
                points="202.8,38.21 212.53,57.94 234.3,61.1 218.55,76.46 222.27,98.14 202.8,87.9 183.32,98.14 187.04,76.46 171.29,61.1 193.06,57.94"
              />
              <path
                fill="#ED2024"
                d="M149.52,0.09L94.2,0H64.14H0v30.06h62.2V140.5H94.2V71.42l0.1-10.16c0-0.03,0.03-1.86,0.03-1.89C94.99,41.57,112.28,10.5,149.52,0.09z"
              />
            </svg>
            <span className="font-[var(--font-heading)] text-[15px] font-extrabold tracking-tight text-white">
              Tournament Guru
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-white/40 hover:text-white/70 md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="tg-scroll-dark flex-1 space-y-7 overflow-y-auto px-3 pb-6">
          {groups.map(([section, entries]) => (
            <div key={section}>
              {section && (
                <p className="mb-2.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/30">
                  {section}
                </p>
              )}
              <ul className="space-y-0.5">
                {entries.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                          active
                            ? "bg-white/[0.1] text-white"
                            : "text-white/55 hover:bg-white/[0.06] hover:text-white/90",
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
                          />
                        )}
                        <Icon
                          name={item.icon}
                          className={cn("h-4 w-4 shrink-0", !active && "opacity-70")}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Role context */}
        {(isEd || showOrgCard) && (
          <div className="space-y-3 border-t border-white/[0.08] px-4 py-5">
            {isEd && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3.5">
                <p className="text-[12.5px] font-bold text-white">
                  Premium listings
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Feature your events in Spotlight and search-top placements.
                </p>
                {onAddOnsPage ? (
                  <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-red-400">
                    You&apos;re here
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                ) : (
                  <Link
                    href={"/dashboard/add-ons" as Route}
                    onClick={() => setOpen(false)}
                    className="mt-2 inline-block text-[12.5px] font-semibold text-red-400 transition-colors hover:text-red-300 hover:underline"
                  >
                    Learn more
                  </Link>
                )}
              </div>
            )}
            {showOrgCard && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                  <SafeImg
                    src={safeImageSrc(orgLogoUrl) ?? undefined}
                    alt={orgTitle ?? "Organization logo"}
                    className="h-full w-full object-cover"
                    fallback={
                      <span className="font-[var(--font-heading)] text-[15px] font-extrabold text-slate-900">
                        {(orgTitle ?? "O").charAt(0).toUpperCase()}
                        <span className="text-red-600">.</span>
                      </span>
                    }
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold text-white">
                    {orgTitle ?? "Your organization"}
                  </p>
                  <p className="truncate text-[11px] font-medium text-white/40">
                    {isEd ? "Organization" : "Club"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legal footer — labels mirror the public site footer. */}
        <div className="flex items-center gap-2.5 border-t border-white/[0.08] px-5 py-4 text-[11px] font-medium text-white/35">
          {(
            [
              ["Privacy", "/privacy"],
              ["Legal", "/terms"],
              ["Cookies", "/cookies"],
            ] as const
          ).map(([label, href], i) => (
            <span key={href} className="flex items-center gap-2.5">
              {i > 0 && <span aria-hidden="true">·</span>}
              <Link
                href={href as Route}
                onClick={() => setOpen(false)}
                className="transition-colors hover:text-white/70"
              >
                {label}
              </Link>
            </span>
          ))}
        </div>
      </aside>
    </>
  );
}

function groupBySection(items: NavItem[]): [string, NavItem[]][] {
  const order: string[] = [];
  const map = new Map<string, NavItem[]>();
  for (const item of items) {
    const section = item.section ?? "";
    if (!map.has(section)) {
      order.push(section);
      map.set(section, []);
    }
    map.get(section)!.push(item);
  }
  return order.map((s) => [s, map.get(s)!]);
}
