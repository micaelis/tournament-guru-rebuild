"use client";

import { useState } from "react";
import {
  Avatar,
  Card,
  StarRating,
} from "@/app/components/ui";
import { HelpfulButton } from "./HelpfulButton";
import { FlagDialog } from "./FlagDialog";
import { CommentTree } from "./CommentTree";
import type { CommentRow, ReviewCardRow } from "@/lib/reviews/queries";
import { roleDisplayLabel } from "@/lib/reviews/shared";
import { REVIEW_CATEGORIES, formatRating } from "@/lib/reviews/shared";

/**
 * Public review card. Renders the reviewer identity (with GURU badge
 * for verified coaches), the six category ratings + overall, body,
 * Helpful toggle, and a collapsible comments section. Comments load
 * eagerly for the page's already-fetched set — the spec's threading
 * happens inside CommentTree.
 */
export function ReviewCard({
  review,
  comments,
  currentUserId,
  isAdmin,
  helpful,
  bannedWords,
  eventContext,
}: {
  review: ReviewCardRow;
  comments: CommentRow[];
  currentUserId: string | null;
  isAdmin: boolean;
  helpful: boolean;
  bannedWords: string[];
  /** Where the review was written — shown on pages that list reviews
   * across events (public ED / attendee profiles); the event page
   * itself omits it. */
  eventContext?: { title: string; href: string };
}) {
  const [flagOpen, setFlagOpen] = useState(false);
  const [showComments, setShowComments] = useState(comments.length > 0);
  const displayName = review.anonymized
    ? "Former member"
    : [review.author?.first_name, review.author?.last_name]
        .filter(Boolean)
        .join(" ") || "Reviewer";
  const org = review.author?.organization_title ?? null;
  const roleLabel = roleDisplayLabel(review.reviewer_role, review.guru_review);
  const promoChip =
    review.reviewer_role === "coach" && review.guru_review
      ? review.promo_pretty_code
      : null;
  const isOwnReview = currentUserId === review.author_id;

  return (
    <Card
      className={`p-6 ${
        review.guru_review
          ? "border-red-200 shadow-[0_2px_10px_rgba(220,38,38,0.08)]"
          : ""
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar
            src={review.author?.profile_photo_url}
            name={displayName}
            size={44}
          />
          <div>
            <p className="text-[15px] font-bold text-slate-900">{displayName}</p>
            {org && <p className="text-[12px] text-slate-500">{org}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {roleLabel}
                {promoChip ? ` · ${promoChip}` : ""}
              </span>
              {review.guru_review && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_2px_8px_rgba(220,38,38,0.35)]"
                  title="Verified — written by a coach through the promo-code flow"
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 1.6l2.6 1.9 3.2-.1 1 3.05 2.6 1.85-1 3.05 1 3.05-2.6 1.85-1 3.05-3.2-.1L12 22.4l-2.6-1.9-3.2.1-1-3.05L2.6 15.7l1-3.05-1-3.05 2.6-1.85 1-3.05 3.2.1L12 1.6zm-1.2 13.9l5-5-1.4-1.4-3.6 3.6-1.8-1.8L7.6 12l3.2 3.5z" />
                  </svg>
                  Guru Review
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">
            {formatDate(review.published_at ?? review.created_at)}
          </p>
          <div className="mt-1">
            <StarRating value={review.overall ?? 0} showNumber size={16} />
          </div>
        </div>
      </header>

      {eventContext && (
        <a
          href={eventContext.href}
          className="mt-3.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-600 no-underline hover:border-slate-400 hover:text-slate-900"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M8 2v3M16 2v3M3.5 9h17M5 4.5h14a1.5 1.5 0 011.5 1.5v14a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 20V6A1.5 1.5 0 015 4.5z" />
          </svg>
          <span className="truncate">{eventContext.title}</span>
        </a>
      )}

      {review.review_title && (
        <h3 className="mt-4 font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          {review.review_title}
        </h3>
      )}
      {review.review_body && (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
          {review.review_body}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs md:grid-cols-3">
        {REVIEW_CATEGORIES.map((c) => (
          <div
            key={c.key}
            className="flex items-center justify-between"
          >
            <span className="text-slate-500">{c.label}</span>
            <span className="font-bold text-slate-800">
              {formatRating(review[c.key] as number | null)}
            </span>
          </div>
        ))}
        {review.would_return !== null && (
          <div className="col-span-2 mt-1 flex items-center justify-between md:col-span-3">
            <span className="text-slate-500">Would return?</span>
            <span className="font-bold text-slate-800">
              {review.would_return ? "Yes" : "No"}
            </span>
          </div>
        )}
      </div>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpfulButton
            reviewId={review.id}
            initialHelpful={helpful}
            initialCount={review.helpful_count}
            disabled={!currentUserId}
          />
          <button
            type="button"
            onClick={() => setShowComments((s) => !s)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12.5px] font-semibold text-slate-700 hover:border-slate-400"
          >
            {showComments ? "Hide" : "Show"} comments · {comments.length}
          </button>
        </div>
        {currentUserId && !isOwnReview && !isAdmin && (
          <button
            type="button"
            onClick={() => setFlagOpen(true)}
            className="text-[12px] font-semibold text-slate-500 hover:text-red-600"
          >
            Flag review
          </button>
        )}
      </footer>

      {showComments && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          {currentUserId ? (
            <CommentTree
              reviewId={review.id}
              comments={comments}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              bannedWords={bannedWords}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
              Sign in to read and post comments.
            </p>
          )}
        </div>
      )}

      {flagOpen && (
        <FlagDialog
          open={flagOpen}
          contentType="review"
          contentId={review.id}
          onClose={() => setFlagOpen(false)}
          onFlagged={() => setFlagOpen(false)}
        />
      )}
    </Card>
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
