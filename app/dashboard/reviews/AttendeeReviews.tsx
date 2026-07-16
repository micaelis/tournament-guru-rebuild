"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  StarRating,
  StatusPill,
} from "@/app/components/ui";
import type { ReviewCardRow } from "@/lib/reviews/queries";
import { REVIEW_CATEGORIES, formatRating, isReviewStillEditable } from "@/lib/reviews/shared";

type SortKey = "newest" | "oldest" | "best" | "worst";

/**
 * Attendee "My Reviews" page. Sort by newest/oldest/best/worst overall,
 * filter by state (only states the user has reviewed in — spec).
 * Edit CTA hidden when past the 30-day window; a soft nudge explains
 * why (spec).
 */
export function AttendeeReviews({ rows }: { rows: ReviewCardRow[] }) {
  const [sort, setSort] = useState<SortKey>("newest");
  const [state, setState] = useState<string>("");

  // Attendee list doesn't join event state; the location filter uses
  // the review's snapshot fields (if the event was deleted) or an
  // on-demand lookup by event_id. Snapshot covers detached rows;
  // for live rows we defer the state lookup to a follow-up if the
  // spec requires it — the list still filters by the snapshot value
  // when present.
  const availableStates = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => r.snapshot_event_location?.slice(-2))
          .filter((v): v is string => Boolean(v && /^[A-Z]{2}$/.test(v))),
      ),
    ).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!state) return rows;
    return rows.filter(
      (r) => r.snapshot_event_location?.slice(-2) === state,
    );
  }, [rows, state]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "newest":
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "oldest":
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "best":
        list.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
        break;
      case "worst":
        list.sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0));
        break;
    }
    return list;
  }, [filtered, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort reviews"
          className="tg-control tg-select w-auto min-w-[200px]"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="best">Best to worst</option>
          <option value="worst">Worst to best</option>
        </select>
        {availableStates.length > 0 && (
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            aria-label="Filter by state"
            className="tg-control tg-select w-auto min-w-[160px]"
            disabled={availableStates.length === 0}
          >
            <option value="">All states</option>
            {availableStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {sorted.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            body="After you attend an event, come back here to leave a review."
            action={
              <Link href={"/events" as Route}>
                <Button>Browse events</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No reviews match your filters"
            body="Try adjusting the state filter above."
          />
        )
      ) : (
        <div className="space-y-4">
          {sorted.map((r) => (
            <MyReviewCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function MyReviewCard({ row }: { row: ReviewCardRow }) {
  const eventTitle = row.snapshot_event_title || "Event";
  const editable = isReviewStillEditable(row.snapshot_event_end ?? null);
  return (
    <Card className="p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <StatusPill tone={row.status === "published" ? "success" : "draft"}>
              {row.status === "published" ? "Published" : "Draft"}
            </StatusPill>
          </div>
          {row.event_id ? (
            <Link
              href={`/events/${row.event_id}` as Route}
              className="mt-2 block text-lg font-extrabold text-slate-900 hover:text-red-600"
            >
              {eventTitle}
            </Link>
          ) : (
            <p className="mt-2 text-lg font-extrabold text-slate-900">
              {eventTitle}{" "}
              <span className="text-sm font-medium text-slate-400">
                · Event removed
              </span>
            </p>
          )}
        </div>
        <StarRating value={row.overall ?? 0} size={14} />
      </header>

      {row.review_title && (
        <p className="mt-3 text-[15px] font-bold text-slate-900">
          {row.review_title}
        </p>
      )}
      {row.review_body && (
        <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
          {row.review_body}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 md:grid-cols-3">
        {REVIEW_CATEGORIES.map((c) => (
          <span key={c.key} className="flex items-center justify-between">
            <span>{c.label}</span>
            <span className="font-bold text-slate-800">
              {formatRating(row[c.key] as number | null)}
            </span>
          </span>
        ))}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="text-slate-500">
          {row.helpful_count} helpful
        </p>
        {row.event_id && editable ? (
          <Link href={`/events/${row.event_id}/review` as Route}>
            <Button size="sm">Edit review</Button>
          </Link>
        ) : row.event_id && row.status === "published" ? (
          <p className="text-[11px] text-slate-500">
            Editing is locked — the event ended more than 30 days ago.
          </p>
        ) : null}
      </footer>
    </Card>
  );
}
