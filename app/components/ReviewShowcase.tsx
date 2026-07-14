import { Stars } from "./Stars";
import { Avatar } from "./Avatar";
import { ReviewCard } from "./ReviewCard";
import type { ReviewRow } from "@/lib/supabase/queries";

function eventTitleOf(r: ReviewRow): string | null {
  const raw = r.events;
  const data = Array.isArray(raw) ? raw[0] : raw;
  return data?.title ?? null;
}

/* A review is "showcase-worthy" only if it has a real title AND a real body —
   short entries like "Thank you" or "ref issues" would look thin blown up,
   so those flow into the supporting grid instead. */
function isSubstantial(r: ReviewRow): boolean {
  const title = r.review_title?.trim() ?? "";
  const body = r.review_body?.trim() ?? "";
  return title.length >= 8 && body.length >= 90;
}

function pickLead(reviews: ReviewRow[]): ReviewRow | null {
  const withRating = (r: ReviewRow) => r.overall_rating ?? 0;
  const substantial = reviews
    .filter(isSubstantial)
    .sort((a, b) => withRating(b) - withRating(a));
  if (substantial.length > 0) return substantial[0];
  // graceful fallback: longest body available, if any is reasonably long
  const byBody = [...reviews]
    .filter((r) => (r.review_body?.trim().length ?? 0) >= 120)
    .sort(
      (a, b) =>
        (b.review_body?.trim().length ?? 0) - (a.review_body?.trim().length ?? 0)
    );
  return byBody[0] ?? null;
}

export function ReviewShowcase({ reviews }: { reviews: ReviewRow[] }) {
  // Franco's "perfect square": exactly 4 reviews, one wide lead across
  // the top row + three equal-width supporting cards below. We still use
  // pickLead when we can (best editorial candidate), but if it doesn't
  // find a rich-enough review we fall back to the first entry so the
  // layout still fires — never the plain flat grid.
  const lead = pickLead(reviews) ?? reviews[0] ?? null;
  if (!lead) return null;

  const supporting = reviews.filter((r) => r.id !== lead.id).slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <LeadReview review={lead} />
      {supporting.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {supporting.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadReview({ review }: { review: ReviewRow }) {
  const eventTitle = eventTitleOf(review);
  const body = review.review_body?.trim() ?? "";
  const rating = review.overall_rating != null ? Number(review.overall_rating) : null;

  return (
    <figure
      className="relative isolate overflow-hidden rounded-3xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        boxShadow: "0 14px 40px -22px rgba(15,23,42,.22), 0 1px 2px rgba(15,23,42,.04)",
        margin: 0,
      }}
    >
      {/* Soft brand wash in the corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 z-0"
        style={{
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(220,38,38,.09), transparent 68%)",
        }}
      />

      <div
        className="relative z-[1] grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto] md:items-center"
        style={{ padding: "30px 32px" }}
      >
        <div className="min-w-0">
          {/* Guru badge */}
          {review.guru_review && (
            <span
              className="font-heading mb-3 inline-flex items-center gap-1.5 rounded-full uppercase text-white"
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                background:
                  "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
                padding: "4px 10px 4px 8px",
                letterSpacing: ".08em",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="var(--color-gold-bright)"
                stroke="var(--color-gold-bright)"
                strokeWidth="2.2"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
              </svg>
              Guru Review
            </span>
          )}

          {/* Big quote mark */}
          <svg
            width="40"
            height="32"
            viewBox="0 0 40 32"
            fill="rgba(220,38,38,.16)"
            aria-hidden="true"
            style={{ marginBottom: 4 }}
          >
            <path d="M0 32V18C0 8 6 1.5 16 0l2 5C11 6.5 8 10 8 15h7v17H0zm22 0V18C22 8 28 1.5 38 0l2 5c-7 1.5-10 5-10 10h7v17H22z" />
          </svg>

          {review.review_title && (
            <div
              className="font-heading text-dark"
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: ".02em",
                textTransform: "uppercase",
                color: "var(--color-accent)",
                marginBottom: 6,
              }}
            >
              {review.review_title}
            </div>
          )}

          <blockquote
            className="font-heading text-dark"
            style={{
              margin: 0,
              fontSize: "clamp(19px, 2.2vw, 24px)",
              fontWeight: 500,
              letterSpacing: "-0.015em",
              lineHeight: 1.4,
            }}
          >
            &ldquo;{body}&rdquo;
          </blockquote>

          {/* Attribution */}
          <figcaption
            className="mt-6 flex flex-wrap items-center gap-3"
            style={{ borderTop: "1px solid var(--color-border-light)", paddingTop: 18 }}
          >
            <Avatar name={review.username || "Anonymous"} size={44} />
            <div className="min-w-0">
              <div
                className="text-dark"
                style={{ fontSize: 14.5, fontWeight: 700 }}
              >
                {review.username || "Anonymous"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                {review.user_role || "Verified attendee"}
                {eventTitle && (
                  <>
                    <span style={{ color: "#cbd5e1" }}> · </span>
                    {eventTitle}
                  </>
                )}
              </div>
            </div>
            {rating != null && (
              <span className="ml-auto">
                <Stars rating={rating} count={null} size={16} />
              </span>
            )}
          </figcaption>
        </div>
      </div>
    </figure>
  );
}
