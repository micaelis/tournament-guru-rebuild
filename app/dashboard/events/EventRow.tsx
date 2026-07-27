"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SafeImg,
  StatusPill,
  StarRating,
  cn,
  eventStatusTone,
} from "@/app/components/ui";
import { Icon } from "@/app/dashboard/icons";
import { safeImageSrc } from "@/lib/url";
import { EventActions } from "./EventActions";
import { RatingsBreakdown } from "./RatingsBreakdown";
import {
  EVENT_GRID_CLASS,
  breakdownLinkClass,
  deriveEventStatus,
  type EventListRow,
} from "./event-shared";

/**
 * One row of the events table: logo + title + badge pills + host club,
 * status, dates (relative hint + season chip beneath), reviews &
 * rating with the collapsible per-event breakdown, and the action pack
 * (Upgrade → Edit → "…"). Clicking anywhere on the row opens the
 * internal event details page; the interactive cells stop propagation.
 *
 * Premium rows carry the accent spine + warm wash; canceled rows gray
 * their identity cell out but keep their history readable (spec: "the
 * event card should be grayed out").
 */
export function EventRow({
  event,
  seasonLabel,
  canManage,
  isAdmin,
}: {
  event: EventListRow;
  seasonLabel: string | null;
  canManage: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const status = deriveEventStatus(event);
  const isCanceled = status === "Canceled";
  const detailsHref = `/dashboard/events/${event.id}` as Route;
  const logoSrc = safeImageSrc(event.logo_url);
  const hasRating = event.review_count > 0 && event.general_rating !== null;

  return (
    <li className="border-t border-slate-100">
      <div
        onClick={() => router.push(detailsHref)}
        className={cn(
          EVENT_GRID_CLASS,
          "cursor-pointer px-5 py-2.5 transition-colors hover:bg-[#fafbfd]",
          event.is_premium &&
            "bg-[linear-gradient(90deg,rgba(220,38,38,0.055),rgba(220,38,38,0.018)_40%,rgba(220,38,38,0)_68%)] shadow-[inset_3px_0_0_#dc2626]",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-2.5",
            isCanceled && "opacity-75",
          )}
        >
          {logoSrc ? (
            <span
              className={cn(
                "h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200",
                isCanceled && "grayscale",
              )}
            >
              <SafeImg
                src={logoSrc}
                alt=""
                className="h-full w-full object-cover"
                fallback={<LogoPlaceholder plain />}
              />
            </span>
          ) : (
            <LogoPlaceholder />
          )}
          <div className="min-w-0">
            <Link
              href={detailsHref}
              onClick={(e) => e.stopPropagation()}
              className="block truncate font-[var(--font-heading)] text-[13.5px] font-extrabold tracking-tight text-slate-900 transition-colors hover:text-red-600"
            >
              {event.title || "Untitled event"}
            </Link>
            <p className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-slate-500">
              {event.is_premium && (
                <StatusPill tone="premium" compact>
                  Premium
                </StatusPill>
              )}
              {event.is_general_ad && (
                <StatusPill tone="spotlight" compact>
                  Spotlight
                </StatusPill>
              )}
              {event.host_club && (
                <span className="truncate">{event.host_club}</span>
              )}
            </p>
          </div>
        </div>

        <div>
          <StatusPill tone={eventStatusTone(status)}>{status}</StatusPill>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold text-slate-800">
            {formatDateRange(event.start_date, event.end_date) || "Dates TBD"}
          </p>
          {dateHint(event, status) && (
            <p className="truncate text-[10.5px] font-medium text-slate-400">
              {dateHint(event, status)}
            </p>
          )}
          {seasonLabel && (
            <span className="mt-1 inline-flex max-w-full items-center truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-px text-[10px] font-semibold text-slate-600">
              {seasonLabel}
            </span>
          )}
        </div>

        <div onClick={(e) => e.stopPropagation()} className="cursor-default">
          {hasRating ? (
            <>
              <div className="flex items-center gap-1.5">
                <StarRating
                  value={event.general_rating ?? 0}
                  size={15}
                  showNumber={false}
                />
                <span className="font-[var(--font-heading)] text-[13.5px] font-extrabold text-slate-900">
                  {(event.general_rating ?? 0).toFixed(2)}
                  <span className="text-[10px] font-bold text-slate-400">
                    /5
                  </span>
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                {event.review_count} verified{" "}
                <span aria-hidden className="text-slate-300">
                  ·
                </span>{" "}
                <button
                  type="button"
                  aria-expanded={breakdownOpen}
                  onClick={() => setBreakdownOpen((o) => !o)}
                  className={cn(
                    "text-[11px]",
                    breakdownLinkClass(breakdownOpen),
                  )}
                >
                  Breakdown
                  <Icon
                    name="chevron-down"
                    className={cn(
                      "h-2.5 w-2.5 transition-transform",
                      breakdownOpen && "rotate-180",
                    )}
                  />
                </button>
              </p>
            </>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              No reviews yet
            </p>
          )}
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className="flex cursor-default items-center gap-1.5 xl:justify-end"
        >
          {(canManage || isAdmin) && (
            <EventActions
              eventId={event.id}
              eventTitle={event.title || "Untitled event"}
              status={status}
              isPremium={event.is_premium}
              canManage={canManage}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>

      {breakdownOpen && hasRating && (
        <div className="px-5 pb-3 pt-1">
          <RatingsBreakdown
            label={`${event.title || "Untitled event"} ratings breakdown`}
            overall={event.general_rating}
            coach={event.coach_rating}
            attendee={event.attendee_rating}
            reviewCount={event.review_count}
            showCoach={event.is_premium}
            wouldReturnPct={event.would_return_pct}
            categories={[
              { label: "Fields", value: event.avg_fields },
              { label: "Facilities", value: event.avg_facilities },
              { label: "Management", value: event.avg_management },
              { label: "Competition", value: event.avg_competition },
              { label: "Diversity", value: event.avg_diversity },
              { label: "Cost / value", value: event.avg_cost_value },
            ]}
            onClose={() => setBreakdownOpen(false)}
          />
        </div>
      )}
    </li>
  );
}

function LogoPlaceholder({ plain = false }: { plain?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center text-slate-400",
        !plain &&
          "overflow-hidden rounded-lg border-[1.5px] border-dashed border-slate-300",
      )}
    >
      <Icon name="image" className="h-[15px] w-[15px]" />
    </span>
  );
}

/** "Aug 14–16, 2026" when the range shares a month, otherwise the full
 *  pair; single days collapse to one date. Always en-US. */
function formatDateRange(start: string | null, end: string | null): string {
  const s = parseDay(start);
  const e = parseDay(end);
  if (!s && !e) return "";
  if (s && e && start === end) return long(s);
  if (s && e) {
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return `${s.toLocaleDateString("en-US", { month: "short" })} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
    }
    return `${long(s)} – ${long(e)}`;
  }
  return long((s ?? e) as Date);
}

function long(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseDay(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** The quiet line under the date range — the one fact worth surfacing
 *  for the row's current status. */
function dateHint(
  event: EventListRow,
  status: ReturnType<typeof deriveEventStatus>,
): string | null {
  const today = new Date().toISOString().slice(0, 10);
  switch (status) {
    case "Draft":
      return "not published yet";
    case "Canceled":
      return "canceled";
    case "Ongoing":
      return "happening now";
    case "Upcoming": {
      if (event.registration_deadline && event.registration_deadline >= today) {
        const d = parseDay(event.registration_deadline);
        if (d)
          return `reg closes ${d.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })}`;
      }
      const days = daysBetween(today, event.start_date);
      if (days === null) return null;
      if (days <= 0) return "starts today";
      return `starts in ${days} ${days === 1 ? "day" : "days"}`;
    }
    case "Concluded": {
      const days = daysBetween(event.end_date, today);
      if (days === null) return null;
      if (days < 1) return "ended today";
      if (days < 31) return `ended ${days} ${days === 1 ? "day" : "days"} ago`;
      const months = Math.round(days / 30.44);
      if (months < 12)
        return `ended ${months} ${months === 1 ? "month" : "months"} ago`;
      const years = Math.floor(months / 12);
      return `ended ${years} ${years === 1 ? "year" : "years"} ago`;
    }
  }
}

function daysBetween(
  fromIso: string | null,
  toIso: string | null,
): number | null {
  const from = parseDay(fromIso);
  const to = parseDay(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
