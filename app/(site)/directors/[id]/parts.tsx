"use client";

/* DirectorTabs — client-side tab switcher for the /directors/[id] page.
   Mimics the Bubble ed_public layout (Events | Reviews). Mobile-first:
   the tab bar is a two-column pill row that stretches, the event grid
   collapses to a single column, and the review list stacks. */

import { useMemo, useState } from "react";
import { EventCard } from "@/app/components/EventCard";
import { Stars } from "@/app/components/Stars";
import { ReviewCard } from "@/app/components/reviews/ReviewCard";
import type { EventRow } from "@/app/components/types";
import type { CommentRow, ReviewCardRow } from "@/lib/reviews/queries";

type Summary = { rating: number; reviews: number };

/* Spec: the events list sorts by the same options as the search page,
   defaulting to publish date; the paid flag is the FIXED second key
   (search instead pins premium first). */
type DirectorEventSort = "published" | "teams" | "date" | "rating";

const EVENT_SORTS: { value: DirectorEventSort; label: string }[] = [
  { value: "published", label: "Recently published" },
  { value: "teams", label: "Most teams" },
  { value: "date", label: "Date · soonest" },
  { value: "rating", label: "Highest rated" },
];

export function DirectorTabs({
  eventCount,
  reviewCount,
  events,
  reviews,
  commentsByReview,
  helpfulReviewIds,
  currentUserId,
  isAdmin,
  bannedWords,
  eventTitleById,
  coachSummary,
  attendeeSummary,
}: {
  eventCount: number;
  reviewCount: number;
  events: EventRow[];
  reviews: ReviewCardRow[];
  commentsByReview: Record<string, CommentRow[]>;
  helpfulReviewIds: string[];
  currentUserId: string | null;
  isAdmin: boolean;
  bannedWords: string[];
  eventTitleById: Record<string, string>;
  coachSummary: Summary;
  attendeeSummary: Summary;
}) {
  const [tab, setTab] = useState<"events" | "reviews">("events");

  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Director sections"
        className="grid grid-cols-2 gap-1 rounded-full p-1"
        style={{
          maxWidth: 360,
          margin: "0 auto",
          background: "var(--color-surface-alt)",
          border: "1px solid var(--color-border)",
        }}
      >
        <TabButton
          active={tab === "events"}
          onClick={() => setTab("events")}
          count={eventCount}
        >
          Events
        </TabButton>
        <TabButton
          active={tab === "reviews"}
          onClick={() => setTab("reviews")}
          count={reviewCount}
        >
          Reviews
        </TabButton>
      </div>

      {/* Content */}
      <div className="mt-6">
        {tab === "events" ? (
          <EventsTab events={events} />
        ) : (
          <ReviewsTab
            reviews={reviews}
            commentsByReview={commentsByReview}
            helpfulReviewIds={helpfulReviewIds}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            bannedWords={bannedWords}
            eventTitleById={eventTitleById}
            coach={coachSummary}
            attendee={attendeeSummary}
          />
        )}
      </div>
    </div>
  );
}

/* ── Tab button ─────────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="tg-hover font-heading cursor-pointer rounded-full transition-all"
      style={{
        background: active ? "#fff" : "transparent",
        color: active ? "var(--color-dark)" : "var(--color-text-secondary)",
        boxShadow: active
          ? "0 2px 8px -2px rgba(15,23,42,.15), 0 1px 2px rgba(15,23,42,.06)"
          : "none",
        border: "none",
        padding: "10px 14px",
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: "-0.005em",
      }}
    >
      {children}
      <span
        className="ml-1.5 inline-flex items-center justify-center rounded-full"
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          padding: "1px 7px",
          background: active
            ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
            : "rgba(15,23,42,.06)",
          color: active ? "var(--color-accent)" : "var(--color-text-muted)",
          letterSpacing: 0,
        }}
      >
        {count}
      </span>
    </button>
  );
}

/* ── Events tab ─────────────────────────────────────────────────────── */

function EventsTab({ events }: { events: EventRow[] }) {
  const [sort, setSort] = useState<DirectorEventSort>("published");

  const sorted = useMemo(() => sortDirectorEvents(events, sort), [events, sort]);

  if (events.length === 0) {
    return (
      <EmptyBlock
        title="No events yet"
        detail="When this director posts events, they'll show up here."
      />
    );
  }
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <label
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "var(--color-text-faint)" }}
        >
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as DirectorEventSort)}
            className="tg-hover cursor-pointer rounded-[10px] border bg-white py-[7px] pl-3 pr-8 text-[13px] font-semibold"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-dark)",
              appearance: "none",
              WebkitAppearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            {EVENT_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sorted.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}

/** Selected key first, paid flag ALWAYS second, publish date as the
 * stable fallback. Nulls sort last within the selected key. */
function sortDirectorEvents(
  events: EventRow[],
  sort: DirectorEventSort,
): EventRow[] {
  const primary = (a: EventRow, b: EventRow): number => {
    switch (sort) {
      case "teams":
        return desc(a.nr_teams_last_year, b.nr_teams_last_year);
      case "date":
        return asc(a.start_date, b.start_date);
      case "rating":
        return desc(a.general_rating, b.general_rating);
      case "published":
        return desc(a.created_at, b.created_at);
    }
  };
  return [...events].sort(
    (a, b) =>
      primary(a, b) ||
      Number(b.premium) - Number(a.premium) ||
      desc(a.created_at, b.created_at),
  );
}

type SortKey = string | number | null | undefined;
function asc(a: SortKey, b: SortKey): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}
function desc(a: SortKey, b: SortKey): number {
  return asc(b, a);
}

/* ── Reviews tab ────────────────────────────────────────────────────── */

function ReviewsTab({
  reviews,
  commentsByReview,
  helpfulReviewIds,
  currentUserId,
  isAdmin,
  bannedWords,
  eventTitleById,
  coach,
  attendee,
}: {
  reviews: ReviewCardRow[];
  commentsByReview: Record<string, CommentRow[]>;
  helpfulReviewIds: string[];
  currentUserId: string | null;
  isAdmin: boolean;
  bannedWords: string[];
  eventTitleById: Record<string, string>;
  coach: Summary;
  attendee: Summary;
}) {
  const helpfulSet = useMemo(
    () => new Set(helpfulReviewIds),
    [helpfulReviewIds],
  );
  return (
    <div>
      {/* Summary strip — two big rating cards echoing Bubble ed_public. */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReviewSummaryCard
          label="Coach Rating"
          rating={coach.rating}
          count={coach.reviews}
        />
        <ReviewSummaryCard
          label="Attendee Rating"
          rating={attendee.rating}
          count={attendee.reviews}
        />
      </div>

      {reviews.length === 0 ? (
        <EmptyBlock
          title="No reviews yet"
          detail="Reviews from coaches and attendees will appear here after events conclude."
        />
      ) : (
        <ul className="flex list-none flex-col gap-4 p-0">
          {reviews.map((r) => {
            const title = r.event_id
              ? eventTitleById[r.event_id] ?? r.snapshot_event_title
              : r.snapshot_event_title;
            return (
              <li key={r.id}>
                <ReviewCard
                  review={r}
                  comments={commentsByReview[r.id] ?? []}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  helpful={helpfulSet.has(r.id)}
                  bannedWords={bannedWords}
                  eventContext={
                    r.event_id && title
                      ? { title, href: `/events/${r.event_id}` }
                      : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReviewSummaryCard({
  label,
  rating,
  count,
}: {
  label: string;
  rating: number;
  count: number;
}) {
  const has = rating > 0;
  return (
    <div
      className="rounded-2xl bg-white text-center"
      style={{
        border: "1px solid var(--color-border)",
        padding: "18px 20px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".14em",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      <div className="mt-2.5 flex items-center justify-center">
        <Stars rating={has ? rating : 0} size={18} />
      </div>
      <div
        className="font-heading mt-1"
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: "var(--color-dark)",
        }}
      >
        {has ? rating.toFixed(2) : "—"} <span style={{ opacity: 0.4 }}>/ 5</span>
      </div>
      <div
        style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}
      >
        {count} review{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function EmptyBlock({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-2xl border border-dashed bg-white p-10 text-center"
      style={{ borderColor: "#cbd5e1" }}
    >
      <div className="mb-1.5" style={{ fontSize: 28 }} aria-hidden="true">
        📭
      </div>
      <div
        className="font-heading"
        style={{ fontSize: 15, fontWeight: 800, color: "var(--color-dark)" }}
      >
        {title}
      </div>
      <div
        className="mt-1"
        style={{ fontSize: 13, color: "var(--color-text-muted)" }}
      >
        {detail}
      </div>
    </div>
  );
}
