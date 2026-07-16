"use client";

/* DirectorTabs — client-side tab switcher for the /directors/[id] page.
   Mimics the Bubble ed_public layout (Events | Reviews). Mobile-first:
   the tab bar is a two-column pill row that stretches, the event grid
   collapses to a single column, and the review list stacks. */

import { useState } from "react";
import { EventCard } from "@/app/components/EventCard";
import { Avatar } from "@/app/components/Avatar";
import { Stars } from "@/app/components/Stars";
import type { EventRow, DirectorReviewRow } from "@/app/components/types";

type Summary = { rating: number; reviews: number };

export function DirectorTabs({
  eventCount,
  reviewCount,
  events,
  reviews,
  coachSummary,
  attendeeSummary,
}: {
  eventCount: number;
  reviewCount: number;
  events: EventRow[];
  reviews: DirectorReviewRow[];
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
  if (events.length === 0) {
    return (
      <EmptyBlock
        title="No events yet"
        detail="When this director posts events, they'll show up here."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}

/* ── Reviews tab ────────────────────────────────────────────────────── */

function ReviewsTab({
  reviews,
  coach,
  attendee,
}: {
  reviews: DirectorReviewRow[];
  coach: Summary;
  attendee: Summary;
}) {
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
        <ul className="flex flex-col gap-3.5">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewItem review={r} />
            </li>
          ))}
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

function ReviewItem({ review }: { review: DirectorReviewRow }) {
  const date = fmtDate(review.created_at);
  const rating = Number(review.overall_rating ?? 0);
  return (
    <article
      className="rounded-2xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        padding: "16px 18px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={review.username || "Anonymous"} size={32} />
          <div className="min-w-0">
            <div
              className="truncate"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-dark)",
              }}
            >
              {review.username || "Anonymous"}
            </div>
            <div
              className="mt-0.5 truncate"
              style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
            >
              {date}
              {review.event_title ? ` · ${review.event_title}` : ""}
            </div>
          </div>
        </div>
        {review.guru_review && <GuruBadge />}
      </div>

      {review.review_title && (
        <h3
          className="font-heading mt-2.5"
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-dark)",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {review.review_title}
        </h3>
      )}

      <div className="mt-1.5">
        <Stars rating={rating} size={14} />
      </div>

      {review.review_body && (
        <p
          className="mt-2.5"
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--color-dark-light)",
            margin: 0,
          }}
        >
          {review.review_body}
        </p>
      )}
    </article>
  );
}

function GuruBadge() {
  return (
    <span
      className="font-heading inline-flex shrink-0 items-center gap-1 rounded-full uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".08em",
        color: "#b91c1c",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      Guru Review
    </span>
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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
