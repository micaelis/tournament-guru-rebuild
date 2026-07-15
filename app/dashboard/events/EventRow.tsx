"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import {
  MetricStrip,
  StatusPill,
  StarRating,
  eventStatusTone,
  type MetricTileData,
} from "@/app/components/ui";
import { cn } from "@/app/components/ui/cn";
import { EventActions } from "./EventActions";
import {
  deriveEventStatus,
  type EventListRow,
} from "./event-shared";

/**
 * One event under a tournament card. Row shows: name / host club /
 * season / dates / status pill / rating. Below the row, the 6-tile
 * event metric strip (collapsible; visible by default).
 *
 * Featured events get an amber-tinted outline; canceled events grey
 * out (spec: "the event card should be grayed out").
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
  const [showMetrics, setShowMetrics] = useState(true);
  const status = deriveEventStatus(event);
  const isCanceled = event.lifecycle === "canceled";
  const featured = event.is_premium || event.is_sponsored;
  const tiles = buildEventTiles(event);

  return (
    <article
      className={cn(
        "rounded-xl border p-4 transition",
        featured
          ? "border-amber-200 bg-amber-50/40"
          : "border-slate-200 bg-white",
        isCanceled && "opacity-60 grayscale",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/events/${event.id}` as Route}
              className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900 hover:text-red-600"
            >
              {event.title || "Untitled event"}
            </Link>
            <StatusPill tone={eventStatusTone(status)}>{status}</StatusPill>
            {event.is_premium && (
              <StatusPill tone="warning">Premium</StatusPill>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {event.host_club && <span>{event.host_club}</span>}
            {seasonLabel && (
              <>
                <span aria-hidden>·</span>
                <span>{seasonLabel}</span>
              </>
            )}
            {(event.start_date || event.end_date) && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {formatDateRange(event.start_date, event.end_date)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {event.review_count > 0 && event.general_rating !== null ? (
            <StarRating
              value={event.general_rating}
              count={event.review_count}
              size={13}
            />
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              No reviews yet
            </span>
          )}
          {(canManage || isAdmin) && (
            <EventActions
              eventId={event.id}
              eventTitle={event.title || "Untitled event"}
              lifecycle={event.lifecycle}
              isPremium={event.is_premium}
              canManage={canManage}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </header>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowMetrics((s) => !s)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400"
        >
          {showMetrics ? "Hide metrics" : "Show metrics"}
        </button>
      </div>

      {showMetrics && event.review_count > 0 && (
        <div className="mt-3">
          <MetricStrip tiles={tiles} collapsible={false} />
        </div>
      )}
    </article>
  );
}

function buildEventTiles(event: EventListRow): MetricTileData[] {
  return [
    { label: "Fields", value: event.avg_fields, count: event.review_count },
    {
      label: "Facilities",
      value: event.avg_facilities,
      count: event.review_count,
    },
    {
      label: "Management",
      value: event.avg_management,
      count: event.review_count,
    },
    {
      label: "Competition",
      value: event.avg_competition,
      count: event.review_count,
    },
    {
      label: "Diversity",
      value: event.avg_diversity,
      count: event.review_count,
    },
    {
      label: "Cost / value",
      value: event.avg_cost_value,
      count: event.review_count,
    },
  ];
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (start && end && start === end) return formatDate(start);
  return [start ? formatDate(start) : "?", end ? formatDate(end) : "?"].join(
    " – ",
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
