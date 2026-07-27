"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  HeaderCountChip,
  SafeImg,
  StarRating,
  StatusPill,
  TextLink,
  cn,
  useToast,
} from "@/app/components/ui";
import { Icon, type IconName } from "../icons";
import { safeImageSrc } from "@/lib/url";
import { US_STATES } from "@/app/components/events/taxonomy";
import { deleteReview } from "@/lib/reviews/actions";
import type { ReviewCardRow } from "@/lib/reviews/queries";
import {
  REVIEW_CATEGORIES,
  deriveLocationChips,
  isReviewStillEditable,
  reviewEditWindowMs,
  reviewStateAbbr,
} from "@/lib/reviews/shared";

type SortKey = "newest" | "oldest" | "best" | "worst";

const STATE_NAMES = new Map(US_STATES.map((s) => [s.code, s.name]));

/** mm/dd/yyyy for a date or timestamp string. Date-only values parse as
 * UTC midnight, so those format in UTC to avoid the off-by-one-day
 * shift in western timezones. */
function fmtDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(
    "en-US",
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? { timeZone: "UTC" } : undefined,
  );
}

/**
 * Attendee "My Reviews" page (S12.44): elevated header with count
 * pills (drafts pill hidden at 0 — drafts are private, "0 drafts" is
 * noise), a toolbar row — location multi-select left, sort right —
 * and one cohesive section-styled card per review. Past the 30-day
 * window the Edit action disables with the dark tooltip.
 */
export function AttendeeReviews({
  rows,
  commentCounts,
}: {
  rows: ReviewCardRow[];
  commentCounts: Record<string, number>;
}) {
  const [sort, setSort] = useState<SortKey>("newest");
  const [states, setStates] = useState<ReadonlySet<string>>(new Set());

  const locationChips = useMemo(() => deriveLocationChips(rows), [rows]);

  const filtered = useMemo(() => {
    if (states.size === 0) return rows;
    return rows.filter((r) => {
      const abbr = reviewStateAbbr(r);
      return abbr !== null && states.has(abbr);
    });
  }, [rows, states]);

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

  const publishedCount = useMemo(
    () => rows.filter((r) => r.status === "published").length,
    [rows],
  );
  const draftCount = rows.length - publishedCount;

  return (
    <div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-2">
          <h1 className="font-[var(--font-heading)] text-2xl font-extrabold tracking-tight text-slate-900">
            My Reviews
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <HeaderCountChip
              icon={<Icon name="star" className="h-3 w-3" />}
              count={rows.length}
              label={rows.length === 1 ? "review" : "reviews"}
            />
            {rows.length > 0 && (
              <HeaderCountChip
                icon={<Icon name="check" className="h-3 w-3" />}
                count={publishedCount}
                label="published"
              />
            )}
            {draftCount > 0 && (
              <HeaderCountChip
                icon={<Icon name="edit" className="h-3 w-3" />}
                count={draftCount}
                label={draftCount === 1 ? "draft" : "drafts"}
              />
            )}
          </div>
        </div>
        <p className="mt-1.5 text-[13.5px] text-slate-600">
          Every review you&rsquo;ve written for the events you&rsquo;ve
          attended — drafts stay private until you publish them.
        </p>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          {locationChips.length > 0 ? (
            <LocationFilter
              chips={locationChips}
              selected={states}
              onChange={setStates}
            />
          ) : (
            <span />
          )}
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white py-[7px] pl-3 pr-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 focus-within:border-red-600 focus-within:ring-[3px] focus-within:ring-red-600/10 hover:border-slate-300">
            <Icon name="sort" className="h-4 w-4 flex-none text-slate-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort reviews"
              className="cursor-pointer appearance-none border-none bg-transparent pr-0.5 text-[13px] font-semibold text-slate-900 outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="best">Best to worst</option>
              <option value="worst">Worst to best</option>
            </select>
            <Icon
              name="chevron-down"
              className="h-3.5 w-3.5 flex-none text-slate-400"
            />
          </label>
        </div>
      )}

      {sorted.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            className="mt-5"
            tone="gold"
            badgeIcon={<Icon name="edit" className="h-3.5 w-3.5" />}
            title="Your first review is waiting"
            body="Been to a tournament lately? Two minutes on the fields, the refs and the schedule helps the next coach pick the right weekend."
            action={
              <Link href={"/events" as Route}>
                <Button variant="accent">Browse events</Button>
              </Link>
            }
            secondary={
              <TextLink href="/dashboard/faq" className="text-[12.5px]">
                How verified reviews work
              </TextLink>
            }
          />
        ) : (
          <EmptyState
            className="mt-5"
            compact
            title="No reviews match your filters"
            body="Try adjusting the filters above."
          />
        )
      ) : (
        <div className="mt-5 space-y-5">
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

/**
 * The location multi-select: approved control chrome on the trigger
 * (selected count rides it), a white checkbox menu of states with
 * per-state published counts. Empty selection = all states.
 */
function LocationFilter({
  chips,
  selected,
  onChange,
}: {
  chips: { state: string; count: number }[];
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
}) {
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

  function toggleState(state: string) {
    const next = new Set(selected);
    if (next.has(state)) next.delete(state);
    else next.add(state);
    onChange(next);
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      role="group"
      aria-label="Filter by location"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-[10px] border bg-white px-3 py-2 text-[13px] font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150",
          open
            ? "border-red-600 ring-[3px] ring-red-600/10"
            : "border-slate-200 hover:border-slate-300",
        )}
      >
        <Icon name="pin" className="h-4 w-4 flex-none text-slate-400" />
        Location
        {selected.size > 0 && (
          <span className="grid h-[18px] min-w-[18px] flex-none place-items-center rounded-full border border-red-300 bg-red-50 px-1 text-[10.5px] font-extrabold leading-none text-red-700">
            {selected.size}
          </span>
        )}
        <Icon
          name="chevron-down"
          className={cn(
            "h-3.5 w-3.5 flex-none text-slate-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,.25)]">
          <p className="px-2.5 pb-1.5 pt-2 font-[var(--font-heading)] text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            Filter by state
          </p>
          {chips.map((chip) => {
            const on = selected.has(chip.state);
            return (
              <button
                key={chip.state}
                type="button"
                aria-pressed={on}
                onClick={() => toggleState(chip.state)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors",
                  on
                    ? "text-red-700 hover:bg-red-50"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <span
                  className={cn(
                    "grid h-4 w-4 flex-none place-items-center rounded-[5px] border-[1.5px] transition-colors",
                    on
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-slate-300 bg-white text-transparent",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-2.5 w-2.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {STATE_NAMES.get(chip.state) ?? chip.state}
                </span>
                <span
                  className={cn(
                    "flex-none rounded-full px-1.5 py-px text-[10.5px] font-extrabold leading-[1.4]",
                    on ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
          <div className="mx-1.5 my-1 h-px bg-slate-100" />
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => onChange(new Set())}
            className="block w-full rounded-lg px-2.5 py-[7px] text-left text-xs font-bold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}

const STAR_POINTS =
  "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";

function MyReviewCard({
  row,
  commentCount,
}: {
  row: ReviewCardRow;
  commentCount: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { push } = useToast();

  const isDraft = row.status !== "published";
  const guru = row.guru_review;
  const eventTitle = row.event?.title ?? row.snapshot_event_title ?? "Event";
  const endDate = row.event?.end_date ?? row.snapshot_event_end ?? null;
  const editable = isReviewStillEditable(endDate);
  const logo = safeImageSrc(row.event?.logo_url ?? row.snapshot_event_logo);
  const publishDeadline = endDate
    ? new Date(new Date(endDate).getTime() + reviewEditWindowMs())
    : null;

  const startDate = row.event?.start_date ?? row.snapshot_event_start ?? null;
  const cityState = row.event
    ? [row.event.location_city, row.event.location_state_abbr]
        .filter(Boolean)
        .join(", ")
    : row.snapshot_event_location;
  const dateRange = startDate
    ? endDate && endDate !== startDate
      ? `${fmtDate(startDate)} – ${fmtDate(endDate)}`
      : fmtDate(startDate)
    : null;
  const metaLine = [row.event?.host_club, cityState, dateRange]
    .filter(Boolean)
    .join(" · ");

  const overall = row.overall;
  const overallLabel =
    overall == null
      ? null
      : Number.isInteger(overall)
        ? String(overall)
        : overall.toFixed(1);

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        guru
          ? "border-red-200 shadow-[inset_3px_0_0_var(--color-accent),0_1px_2px_rgba(15,23,42,0.05),0_14px_34px_-22px_rgba(220,38,38,0.30)] hover:border-red-300"
          : "shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_34px_-22px_rgba(15,23,42,0.18)] hover:border-slate-300",
      )}
    >
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-5 pb-4 pt-4 md:px-6",
          guru &&
            "rounded-t-[15px] bg-gradient-to-r from-red-600/5 via-red-600/[0.015] to-transparent",
        )}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="h-11 w-11 flex-none overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
            <SafeImg
              src={logo ?? undefined}
              alt=""
              className="h-full w-full object-cover"
              fallback={
                <span className="grid h-full w-full place-items-center text-slate-400">
                  <Icon name="image" className="h-5 w-5" />
                </span>
              }
            />
          </span>
          <div className="min-w-0">
            {row.event_id ? (
              <Link
                href={`/events/${row.event_id}` as Route}
                className="block truncate font-[var(--font-heading)] text-[16px] font-extrabold tracking-tight text-slate-900 transition-colors hover:text-red-600"
              >
                {eventTitle}
              </Link>
            ) : (
              <p className="truncate font-[var(--font-heading)] text-[16px] font-extrabold tracking-tight text-slate-900">
                {eventTitle}{" "}
                <span className="text-sm font-medium text-slate-400">
                  · Event removed
                </span>
              </p>
            )}
            {metaLine && (
              <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">
                {metaLine}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          {guru && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-red-500 to-red-700 px-2.5 py-1 font-[var(--font-heading)] text-[10px] font-extrabold uppercase tracking-[0.03em] text-white shadow-[0_4px_10px_-4px_rgba(220,38,38,0.55)]">
              <svg
                viewBox="0 0 24 24"
                className="h-2.5 w-2.5"
                fill="#fde68a"
                aria-hidden
              >
                <polygon points={STAR_POINTS} />
              </svg>
              Guru Review
            </span>
          )}
          <StatusPill tone={isDraft ? "draft" : "success"}>
            {isDraft ? "Draft" : "Published"}
          </StatusPill>
        </div>
      </header>
      <div className="mx-5 h-px bg-slate-100 md:mx-6" />

      <div className="px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StarRating value={overall ?? 0} size={17} showNumber={false} />
          {overallLabel && (
            <span className="font-[var(--font-heading)] text-[18px] font-extrabold leading-none tracking-tight text-slate-900">
              {overallLabel}
              <span className="text-[11px] font-bold text-slate-400">/5</span>
            </span>
          )}
          <span aria-hidden className="hidden h-3.5 w-px bg-slate-200 sm:block" />
          <span className="text-[12.5px] font-medium text-slate-500">
            {isDraft
              ? `Draft saved ${fmtDate(row.created_at)}`
              : `Reviewed ${fmtDate(row.published_at ?? row.created_at)}`}
          </span>
        </div>

        {row.review_title && (
          <h3 className="mt-3 font-[var(--font-heading)] text-[15px] font-bold text-slate-900">
            {row.review_title}
          </h3>
        )}
        {row.review_body && (
          <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">
            {row.review_body}
          </p>
        )}

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="mb-2 px-0.5 font-[var(--font-heading)] text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            Category ratings
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {REVIEW_CATEGORIES.map((c) => {
              const value = (row[c.key] as number | null) ?? 0;
              return (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-2.5 rounded-[9px] border border-slate-100 bg-white px-3 py-1.5"
                >
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-600">
                    {c.label}
                  </span>
                  <span className="flex flex-none items-center gap-1.5">
                    <StarRating value={value} size={12} showNumber={false} />
                    <span className="font-[var(--font-heading)] text-[12px] font-extrabold text-slate-800">
                      {value || "—"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-b-[15px] border-t border-slate-100 bg-slate-50/70 px-5 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {isDraft ? (
            <>
              <Stat icon="lock">Only you can see this draft</Stat>
              {publishDeadline && (
                <Stat icon="clock">
                  {editable ? "Publish window closes" : "Publish window closed"}{" "}
                  <b className="font-extrabold text-slate-900">
                    {fmtDate(publishDeadline.toISOString())}
                  </b>
                </Stat>
              )}
            </>
          ) : (
            <>
              {row.helpful_count > 0 ? (
                <Stat icon="thumb">
                  <b className="font-extrabold text-slate-900">
                    {row.helpful_count}
                  </b>{" "}
                  found this helpful
                </Stat>
              ) : (
                <Stat icon="thumb" zero>
                  No helpful votes yet
                </Stat>
              )}
              {commentCount > 0 ? (
                <Stat icon="comment">
                  <b className="font-extrabold text-slate-900">
                    {commentCount}
                  </b>{" "}
                  {commentCount === 1 ? "comment" : "comments"}
                </Stat>
              ) : (
                <Stat icon="comment" zero>
                  No comments yet
                </Stat>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {row.event_id &&
            (editable ? (
              <Link
                href={`/events/${row.event_id}/review` as Route}
                aria-label="Edit review"
                title="Edit review"
                className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-[#e9eef5] text-slate-600 transition-all duration-200 hover:-translate-y-px hover:bg-[#dbe3ec] hover:text-slate-900"
              >
                <Icon name="edit" className="h-4 w-4" />
              </Link>
            ) : (
              <span className="group relative inline-flex">
                <button
                  type="button"
                  disabled
                  aria-label="Edit review (locked)"
                  aria-describedby={`tip-${row.id}`}
                  className="grid h-[34px] w-[34px] cursor-not-allowed place-items-center rounded-[10px] bg-slate-100 text-slate-300"
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <span
                  role="tooltip"
                  id={`tip-${row.id}`}
                  className="pointer-events-none absolute bottom-[calc(100%+10px)] -right-1 z-30 w-56 rounded-[10px] bg-slate-900 px-3 py-2 text-left text-[11.5px] font-medium leading-[1.55] text-white opacity-0 shadow-[0_14px_30px_-10px_rgba(15,23,42,0.55)] transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  <b className="mb-0.5 flex items-center gap-1.5 text-[11.5px] font-bold text-white">
                    <Icon name="lock" className="h-3 w-3 text-red-300" />
                    Editing locked
                  </b>
                  Reviews lock a month after the event ends.
                </span>
              </span>
            ))}
          <button
            type="button"
            aria-label="Delete review"
            title="Delete review"
            onClick={() => setConfirmOpen(true)}
            className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-red-50 text-red-600 transition-all duration-200 hover:-translate-y-px hover:bg-red-100 hover:text-red-700"
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

/** Footer-band stat: icon in a bordered disc + phrase — never a bare
 * "0"; zero states read as words in the muted tone. */
function Stat({
  icon,
  zero = false,
  children,
}: {
  icon: IconName;
  zero?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[12px] font-semibold",
        zero ? "text-slate-400" : "text-slate-500",
      )}
    >
      <span
        className={cn(
          "grid h-[25px] w-[25px] flex-none place-items-center rounded-full border border-slate-200 bg-white",
          zero ? "text-slate-300" : "text-slate-500",
        )}
      >
        <Icon name={icon} className="h-3 w-3" />
      </span>
      <span>{children}</span>
    </span>
  );
}
