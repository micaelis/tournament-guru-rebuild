"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "../(auth)/actions";
import { Avatar } from "@/app/components/ui/Avatar";
import { cn } from "@/app/components/ui/cn";
import type { NavItem } from "./nav-items";

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
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    "Your account";

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
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-7">
          <Link href={"/" as never} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sm font-extrabold text-white">
              TG
            </span>
            <span className="font-[var(--font-heading)] text-[15px] font-extrabold text-white">
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
        <nav className="flex-1 space-y-7 overflow-y-auto px-3 pb-6">
          {groups.map(([section, entries]) => (
            <div key={section}>
              {section && (
                <p className="mb-3 px-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/30">
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
                          "block rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
                          active
                            ? "bg-white/[0.12] text-white"
                            : "text-white/60 hover:bg-white/[0.06] hover:text-white/90",
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

        {/* User card */}
        <div className="border-t border-white/[0.08] px-4 py-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-3">
            <Avatar
              src={user.profile_photo_url}
              name={fullName}
              size={38}
              dark
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white">
                {fullName}
              </p>
              <p className="truncate text-[11px] font-medium text-white/40">
                {user.role_label}
              </p>
            </div>
          </div>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] font-semibold text-white/50 transition-colors hover:border-white/20 hover:text-white/70"
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
