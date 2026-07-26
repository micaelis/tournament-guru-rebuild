"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  StarRating,
  StatusPill,
  useToast,
} from "@/app/components/ui";
import { Icon } from "../icons";
import { deleteReview } from "@/lib/reviews/actions";
import type { ReviewCardRow } from "@/lib/reviews/queries";
import {
  REVIEW_CATEGORIES,
  REVIEW_EDIT_WINDOW_DAYS,
  deriveLocationChips,
  isReviewStillEditable,
  reviewStateAbbr,
} from "@/lib/reviews/shared";

type SortKey = "newest" | "oldest" | "best" | "worst";

/**
 * Attendee "My Reviews" page. Header row carries the title + count and
 * the sort control; below it, location chips — one per state the user
 * has published a review in, with that count — filter the list. Past
 * the 30-day window the Edit action disables with a tooltip explaining
 * why.
 */
export function AttendeeReviews({
  rows,
  commentCounts,
}: {
  rows: ReviewCardRow[];
  commentCounts: Record<string, number>;
}) {
  const [sort, setSort] = useState<SortKey>("newest");
  const [state, setState] = useState<string>("");

  const locationChips = useMemo(() => deriveLocationChips(rows), [rows]);

  const filtered = useMemo(() => {
    if (!state) return rows;
    return rows.filter((r) => reviewStateAbbr(r) === state);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
            My Reviews
          </h1>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
            {rows.length}
          </span>
        </div>
        {rows.length > 0 && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort reviews"
            className="tg-control tg-select w-auto min-w-[180px]"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="best">Best to worst</option>
            <option value="worst">Worst to best</option>
          </select>
        )}
      </div>

      {locationChips.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by location"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Location
          </span>
          <LocationChip
            active={state === ""}
            onClick={() => setState("")}
            label="All"
          />
          {locationChips.map((chip) => (
            <LocationChip
              key={chip.state}
              active={state === chip.state}
              onClick={() =>
                setState((prev) => (prev === chip.state ? "" : chip.state))
              }
              label={chip.state}
              count={chip.count}
            />
          ))}
        </div>
      )}

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
            body="Try adjusting the filters above."
          />
        )
      ) : (
        <div className="space-y-4">
          {sorted.map((r) => (
            <MyReviewCard
              key={r.id}
              row={r}
              commentCount={commentCounts[r.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** One location-filter chip. Selected = the S12.3 red-tint state. */
function LocationChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-150 ${
        active
          ? "border-red-600 bg-red-50 text-red-700 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span className={active ? "text-red-600/70" : "text-slate-400"}>
          {count}
        </span>
      )}
    </button>
  );
}

function MyReviewCard({
  row,
  commentCount,
}: {
  row: ReviewCardRow;
  commentCount: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { push } = useToast();
  const eventTitle =
    row.event?.title ?? row.snapshot_event_title ?? "Event";
  const editable = isReviewStillEditable(
    row.event?.end_date ?? row.snapshot_event_end ?? null,
  );
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

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-500 md:grid-cols-3">
        {REVIEW_CATEGORIES.map((c) => (
          <span key={c.key} className="flex items-center justify-between gap-2">
            <span>{c.label}</span>
            <StarRating
              value={(row[c.key] as number | null) ?? 0}
              size={11}
            />
          </span>
        ))}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CountChip
            icon="thumb"
            count={row.helpful_count}
            label={`${row.helpful_count} people found this review helpful`}
          />
          <CountChip
            icon="comment"
            count={commentCount}
            label={`${commentCount} comments on this review`}
          />
        </div>
        <div className="flex items-center gap-2">
          {row.event_id &&
            (editable ? (
              <Link
                href={`/events/${row.event_id}/review` as Route}
                aria-label="Edit review"
                title="Edit review"
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
              >
                <Icon name="edit" className="h-4 w-4" />
              </Link>
            ) : (
              <span className="group relative inline-flex">
                <button
                  type="button"
                  disabled
                  aria-label="Edit review (locked)"
                  className="grid h-8 w-8 cursor-not-allowed place-items-center rounded-lg bg-slate-100 text-slate-300"
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-60 rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] font-medium leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  This event ended more than {REVIEW_EDIT_WINDOW_DAYS} days
                  ago, so this review can no longer be edited or published.
                </span>
              </span>
            ))}
          <button
            type="button"
            aria-label="Delete review"
            title="Delete review"
            onClick={() => setConfirmOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this review?"
        body="This permanently removes your review and its comments. It can't be undone."
        confirmLabel="Delete review"
        onConfirm={async () => {
          const res = await deleteReview(row.id);
          if (res.error) {
            push("error", res.error);
            return;
          }
          setConfirmOpen(false);
          push("success", "Your review has been deleted.");
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </Card>
  );
}

function CountChip({
  icon,
  count,
  label,
}: {
  icon: "thumb" | "comment";
  count: number;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-600"
      title={label}
      aria-label={label}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icon === "thumb" ? (
          <>
            <path d="M7 22V11" />
            <path d="M15 22H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h1.5l3-6a1.5 1.5 0 0 1 3 1v6h4a2 2 0 0 1 2 2l-2 8a3 3 0 0 1-3 2z" />
          </>
        ) : (
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        )}
      </svg>
      {count}
    </span>
  );
}
