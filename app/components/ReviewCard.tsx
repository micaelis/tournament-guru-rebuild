import { Stars } from "./Stars";
import { Avatar } from "./Avatar";
import { RoleBadge, GuruBadge } from "./RoleBadge";
import type { ReviewRow } from "@/lib/supabase/queries";

function fmtReviewDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReviewCard({ review }: { review: ReviewRow }) {
  const body = review.review_body;
  const excerpt =
    body && body.length > 180 ? body.slice(0, 180).trimEnd() + "…" : body;
  const date = fmtReviewDate(review.created_at);

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[14px] border bg-white"
      style={{
        borderColor: "var(--color-border)",
        padding: "14px 16px",
      }}
    >
      {/* Reviewer info + role badge */}
      <div className="flex items-start gap-2.5">
        <Avatar name={review.username || "Anonymous"} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div
              className="truncate text-[14px] font-bold"
              style={{ color: "var(--color-dark)" }}
            >
              {review.username || "Anonymous"}
            </div>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <RoleBadge author={review.author} fallbackText={review.user_role} />
              {review.guru_review && <GuruBadge />}
            </span>
          </div>
          {date && (
            <div className="text-text-faint" style={{ fontSize: 11.5 }}>
              {date}
            </div>
          )}
        </div>
      </div>

      {/* Title + stars */}
      <div className="mt-2.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          {review.review_title && (
            <div
              className="font-heading text-dark"
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {review.review_title}
            </div>
          )}
          {review.overall_rating != null && (
            <Stars rating={Number(review.overall_rating)} count={null} size={13} />
          )}
        </div>
        {excerpt && (
          <p
            className="mt-1.5 mb-0"
            style={{
              fontSize: 13,
              color: "var(--color-dark-light)",
              lineHeight: 1.5,
            }}
          >
            {excerpt}
          </p>
        )}
      </div>
    </div>
  );
}
