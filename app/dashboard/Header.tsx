"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "../(auth)/actions";
import { Avatar } from "@/app/components/ui/Avatar";
import { cn } from "@/app/components/ui/cn";
import { Icon } from "./icons";
import type { NavItem } from "./nav-items";

export type RoleTone = "coach" | "attendee" | "neutral";

/** Semantic role colors (the MetricStrip pair): Coach = red, other
 * attendee roles = amber, ED/Admin = neutral slate. */
const ROLE_TEXT: Record<RoleTone, string> = {
  coach: "text-red-600",
  attendee: "text-amber-600",
  neutral: "text-slate-500",
};
const CHIP_TINT: Record<RoleTone, string> = {
  coach: "bg-red-50 text-red-700 ring-red-200",
  attendee: "bg-amber-50 text-amber-700 ring-amber-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};
const CHIP_DOT: Record<RoleTone, string> = {
  coach: "bg-red-500",
  attendee: "bg-amber-500",
  neutral: "bg-slate-400",
};

/**
 * Dashboard top bar: breadcrumb context on the left, the user's
 * identity on the right — a bordered white pill (ringed avatar, name
 * stacked over the role in its semantic color, chevron in a disc that
 * flips open). Clicking it opens the account menu — the ONE place to
 * reach Account and to sign out of the dashboard (the sidebar
 * deliberately carries neither).
 */
export function DashboardHeader({
  items,
  user,
}: {
  items: NavItem[];
  user: {
    name: string;
    roleLabel: string;
    /** The user-type label ("Attendee" / "Event Director" / "Admin")
     * shown beside roleLabel in the menu's role chip when distinct. */
    typeLabel: string;
    roleTone: RoleTone;
    email: string | null;
    photoUrl: string | null;
  };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 pl-16 pr-4 md:px-10">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="hidden font-medium text-slate-400 sm:block">
            Dashboard
          </span>
          <Icon
            name="chevron-right"
            className="hidden h-3.5 w-3.5 text-slate-300 sm:block"
          />
          <span className="truncate font-semibold text-slate-900">
            {currentLabel(items, pathname)}
          </span>
        </div>

        <div ref={rootRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={cn(
              "flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200",
              open
                ? "border-slate-300 bg-slate-50"
                : "hover:border-slate-300 hover:shadow-[0_3px_8px_-2px_rgba(15,23,42,0.12)]",
            )}
          >
            <Avatar
              src={user.photoUrl}
              name={user.name}
              size={34}
              className="ring-1 ring-slate-900/10"
            />
            <span className="hidden text-left sm:block">
              <span className="block text-[13px] font-bold leading-tight text-slate-900">
                {user.name}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-[9.5px] font-extrabold uppercase leading-tight tracking-[0.13em]",
                  ROLE_TEXT[user.roleTone],
                )}
              >
                {user.roleLabel}
              </span>
            </span>
            <span
              className={cn(
                "grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform duration-200",
                open && "rotate-180",
              )}
            >
              <Icon name="chevron-down" className="h-3.5 w-3.5" />
            </span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+10px)] w-[264px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,.25)]"
            >
              <div className="m-1 rounded-[10px] bg-slate-50 px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar src={user.photoUrl} name={user.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-900">
                      {user.name}
                    </p>
                    {user.email && (
                      <p className="truncate text-[11.5px] text-slate-500">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.09em] ring-1",
                    CHIP_TINT[user.roleTone],
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      CHIP_DOT[user.roleTone],
                    )}
                  />
                  {user.roleLabel === user.typeLabel
                    ? user.roleLabel
                    : `${user.roleLabel} · ${user.typeLabel}`}
                </span>
              </div>
              <div className="mx-1.5 my-1 h-px bg-slate-100" />
              <Link
                role="menuitem"
                href={"/dashboard/account" as Route}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon name="user" className="h-[15px] w-[15px] text-slate-400" />
                Account
              </Link>
              <div className="mx-1.5 h-px bg-slate-100" />
              <form action={signOutAction}>
                <button
                  role="menuitem"
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <Icon
                    name="logout"
                    className="h-[15px] w-[15px] text-slate-400"
                  />
                  Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Longest-prefix match against the role's nav so nested routes
 * (/dashboard/events/[id]/edit) still read as their section ("Events").
 * Unmatched routes fall back to a humanized last path segment.
 */
function currentLabel(items: NavItem[], pathname: string): string {
  let best: NavItem | null = null;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  if (best) return best.label;
  const seg = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}
