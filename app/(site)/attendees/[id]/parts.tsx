"use client";

/* AttendeeReviews — the public attendee page's review list with the
   verified-coach / attendee filter. Cards are the shared ReviewCard
   (comments, helpful, flag, GURU badge), each with its event chip. */

import { useMemo, useState } from "react";
import { ReviewCard } from "@/app/components/reviews/ReviewCard";
import type { CommentRow, ReviewCardRow } from "@/lib/reviews/queries";

type Filter = "all" | "coach" | "attendee";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All reviews" },
  { value: "coach", label: "Verified Coach" },
  { value: "attendee", label: "Attendee" },
];

export function AttendeeReviews({
  reviews,
  commentsByReview,
  helpfulReviewIds,
  currentUserId,
  isAdmin,
  bannedWords,
  eventTitleById,
}: {
  reviews: ReviewCardRow[];
  commentsByReview: Record<string, CommentRow[]>;
  helpfulReviewIds: string[];
  currentUserId: string | null;
  isAdmin: boolean;
  bannedWords: string[];
  eventTitleById: Record<string, string>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const helpfulSet = useMemo(
    () => new Set(helpfulReviewIds),
    [helpfulReviewIds],
  );

  // Same capacity split as the rating aggregates: coach vs everything else.
  const shown = useMemo(() => {
    if (filter === "all") return reviews;
    return reviews.filter((r) =>
      filter === "coach"
        ? r.reviewer_role === "coach"
        : r.reviewer_role !== "coach",
    );
  }, [reviews, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="font-heading"
          style={{
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--color-dark)",
            margin: 0,
          }}
        >
          Published reviews
        </h2>
        <div
          role="group"
          aria-label="Filter reviews"
          className="inline-flex rounded-full p-1"
          style={{
            background: "var(--color-surface-alt)",
            border: "1px solid var(--color-border)",
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className="tg-hover font-heading cursor-pointer rounded-full transition-all"
                style={{
                  background: active ? "#fff" : "transparent",
                  color: active
                    ? "var(--color-dark)"
                    : "var(--color-text-secondary)",
                  boxShadow: active
                    ? "0 2px 8px -2px rgba(15,23,42,.15), 0 1px 2px rgba(15,23,42,.06)"
                    : "none",
                  border: "none",
                  padding: "7px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div
          className="mt-4 rounded-2xl border border-dashed bg-white p-10 text-center"
          style={{ borderColor: "#cbd5e1" }}
        >
          <div className="mb-1.5" style={{ fontSize: 28 }} aria-hidden="true">
            📝
          </div>
          <div
            className="font-heading"
            style={{ fontSize: 15, fontWeight: 800, color: "var(--color-dark)" }}
          >
            No reviews here yet
          </div>
          <div
            className="mt-1"
            style={{ fontSize: 13, color: "var(--color-text-muted)" }}
          >
            {filter === "all"
              ? "Reviews this user publishes will appear here."
              : "No published reviews in this capacity yet."}
          </div>
        </div>
      ) : (
        <ul className="mt-4 flex list-none flex-col gap-4 p-0">
          {shown.map((r) => {
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
