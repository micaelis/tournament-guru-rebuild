"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "../(auth)/actions";
import { Avatar } from "@/app/components/ui/Avatar";
import { cn } from "@/app/components/ui/cn";
import type { NavItem } from "./nav-items";

/**
 * Role-aware sidebar. Groups nav items by their `section` label,
 * highlights the active route, and shows the user card + sign-out at
 * the bottom. On < md screens the sidebar collapses into a drawer
 * behind a hamburger.
 */
export function Sidebar({
  items,
  user,
}: {
  items: NavItem[];
  user: {
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
    role_label: string;
  };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = groupBySection(items);
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ") || "Your account";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm md:hidden"
        aria-label="Open menu"
      >
        <span className="block h-0.5 w-5 rounded bg-slate-800" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/50 md:hidden",
          open ? "block" : "hidden",
        )}
        onClick={() => setOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <Link href={"/" as never} className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white text-sm font-extrabold">
              TG
            </span>
            <span className="font-[var(--font-heading)] text-[15px] font-extrabold text-slate-900">
              Tournament Guru
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {groups.map(([section, entries]) => (
            <div key={section}>
              {section && (
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {section}
                </p>
              )}
              <ul className="space-y-1">
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
                          "block rounded-xl px-3 py-2 text-sm font-semibold transition",
                          active
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={user.profile_photo_url}
              name={fullName}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">
                {fullName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {user.role_label}
              </p>
            </div>
          </div>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
            >
              Sign out
            </button>
          </form>
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
