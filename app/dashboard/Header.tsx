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

/**
 * Dashboard top bar: breadcrumb context on the left, the user's
 * identity on the right. Clicking the identity opens the account menu —
 * the ONE place to reach Account and to sign out of the dashboard (the
 * sidebar deliberately carries neither).
 */
export function DashboardHeader({
  items,
  user,
}: {
  items: NavItem[];
  user: {
    name: string;
    roleLabel: string;
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
            className="flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-3 transition-colors hover:bg-slate-100"
          >
            <Avatar src={user.photoUrl} name={user.name} size={32} />
            <span className="hidden text-left sm:block">
              <span className="block text-[13px] font-bold leading-tight text-slate-900">
                {user.name}
              </span>
              <span className="block text-[11px] font-medium leading-tight text-slate-500">
                {user.roleLabel}
              </span>
            </span>
            <Icon
              name="chevron-down"
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+10px)] w-64 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,.25)]"
            >
              <div className="px-3 py-2.5">
                <p className="text-[13px] font-bold text-slate-900">
                  {user.name}
                </p>
                {user.email && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {user.email}
                  </p>
                )}
              </div>
              <div className="mx-1.5 h-px bg-slate-100" />
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
