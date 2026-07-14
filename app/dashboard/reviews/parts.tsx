"use client";

/* ReviewsManager — client-side orchestrator for /dashboard/reviews.
   Mirrors the intent of the Bubble `reviews B` reusable: a filterable
   list of reviews scoped by role, with a summary strip at the top
   showing count + average + flagged count. Search hits the review
   title/body plus reviewer name plus event title. */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardProfile } from "@/lib/supabase/session";
import type { DashboardReviewRow } from "@/lib/supabase/queries";

type PublishedFilter = "all" | "published" | "unpublished";
type FlaggedFilter = "all" | "flagged" | "not_flagged";
type RatingFilter = 0 | 3 | 4 | 5;

export function ReviewsManager({
  reviews,
  error,
  role,
}: {
  reviews: DashboardReviewRow[];
  error: string | null;
  role: DashboardProfile["user_type"];
}) {
  const [query, setQuery] = useState("");
  const [published, setPublished] = useState<PublishedFilter>("all");
  const [flagged, setFlagged] = useState<FlaggedFilter>("all");
  const [minRating, setMinRating] = useState<RatingFilter>(0);

  const isAdmin = role === "admin";

  const totals = useMemo(() => {
    const total = reviews.length;
    const publishedCount = reviews.filter((r) => r.published).length;
    const flaggedCount = reviews.filter((r) => r.flagged).length;
    const avg =
      total > 0
        ? reviews.reduce((sum, r) => sum + Number(r.overall_rating ?? 0), 0) /
          total
        : 0;
    return { total, publishedCount, flaggedCount, avg };
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      if (published === "published" && !r.published) return false;
      if (published === "unpublished" && r.published) return false;
      if (flagged === "flagged" && !r.flagged) return false;
      if (flagged === "not_flagged" && r.flagged) return false;
      if (minRating > 0 && Number(r.overall_rating ?? 0) < minRating)
        return false;
      if (!q) return true;
      const hay = [
        r.review_title ?? "",
        r.review_body ?? "",
        r.username ?? "",
        r.event_title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reviews, query, published, flagged, minRating]);

  return (
    <div>
      {/* Header */}
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full"
            style={{ width: 6, height: 6, background: "var(--color-accent)" }}
          />
          <span
            className="font-heading uppercase"
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".14em",
              color: "var(--color-text-secondary)",
            }}
          >
            {isAdmin ? "Admin · Reviews" : "Your reviews"}
          </span>
        </div>
        <h1
          className="font-heading"
          style={{
            fontSize: "clamp(24px, 3vw, 30px)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--color-dark)",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Reviews
        </h1>
        <p
          className="mt-2 max-w-2xl"
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
          }}
        >
          {isAdmin
            ? "Every review on the platform. Filter by rating, publish state, or flag status."
            : "Reviews left on the events you host, most recent first."}
        </p>
      </header>

      {/* Summary strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          label="Total"
          value={totals.total.toLocaleString()}
        />
        <SummaryTile
          label="Average"
          value={totals.total > 0 ? totals.avg.toFixed(2) : "—"}
          detail={totals.total > 0 ? "/ 5" : undefined}
          gold
        />
        <SummaryTile
          label="Published"
          value={totals.publishedCount.toLocaleString()}
        />
        <SummaryTile
          label="Flagged"
          value={totals.flaggedCount.toLocaleString()}
          alert={totals.flaggedCount > 0}
        />
      </div>

      {/* Toolbar */}
      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div
          className="tg-focus-field flex h-10 min-w-[220px] flex-[1_1_260px] items-center gap-2 rounded-lg bg-white pl-2 pr-1"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "var(--color-text-muted)" }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            aria-label="Search reviews"
            placeholder="Search title, body, reviewer, event…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-0 bg-transparent p-0 text-[14px] outline-none"
            style={{ color: "var(--color-dark)" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full"
              style={{ color: "var(--color-text-faint)" }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        {/* Rating filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={minRating === 0}
            onClick={() => setMinRating(0)}
          >
            Any rating
          </FilterChip>
          {[5, 4, 3].map((r) => (
            <FilterChip
              key={r}
              active={minRating === r}
              onClick={() => setMinRating(r as RatingFilter)}
              icon={<GoldStarGlyph />}
            >
              {r}+
            </FilterChip>
          ))}
        </div>

        {/* Publish + flag filters (admin only for publish) */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={published === "all"}
              onClick={() => setPublished("all")}
            >
              All
            </FilterChip>
            <FilterChip
              active={published === "published"}
              onClick={() => setPublished("published")}
            >
              Published
            </FilterChip>
            <FilterChip
              active={published === "unpublished"}
              onClick={() => setPublished("unpublished")}
            >
              Unpublished
            </FilterChip>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={flagged === "all"}
            onClick={() => setFlagged("all")}
          >
            All
          </FilterChip>
          <FilterChip
            active={flagged === "flagged"}
            onClick={() => setFlagged("flagged")}
            danger
          >
            Flagged only
          </FilterChip>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-[13px]"
          style={{
            borderColor: "var(--color-accent)",
            background: "#fef2f2",
            color: "var(--color-accent-dark)",
          }}
          role="alert"
        >
          Couldn&rsquo;t load reviews: {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          hasFilters={
            query.length > 0 ||
            published !== "all" ||
            flagged !== "all" ||
            minRating > 0
          }
          isAdmin={isAdmin}
          totalCount={reviews.length}
          onReset={() => {
            setQuery("");
            setPublished("all");
            setFlagged("all");
            setMinRating(0);
          }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <ReviewItem review={r} isAdmin={isAdmin} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── review card ──────────────────────────────────────────────────── */

function ReviewItem({
  review,
  isAdmin,
}: {
  review: DashboardReviewRow;
  isAdmin: boolean;
}) {
  const rating = Number(review.overall_rating ?? 0);
  const initials = (review.username || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article
      className="rounded-xl bg-white"
      style={{
        border: `1px solid ${review.flagged ? "#fecaca" : "var(--color-border)"}`,
        padding: "16px 18px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        background: review.flagged
          ? "linear-gradient(180deg, #fef7f7 0%, #ffffff 40%)"
          : "#fff",
      }}
    >
      {/* top row: reviewer + badges */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-full font-heading text-white"
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              fontSize: 13,
              fontWeight: 800,
              background:
                "linear-gradient(135deg, #64748b 0%, #334155 100%)",
              letterSpacing: "-0.02em",
            }}
          >
            {initials}
          </span>
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
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              {review.user_role || "Attendee"} · {fmtDate(review.created_at)}
              {review.event_title && (
                <>
                  {" "}
                  ·{" "}
                  {review.event_id ? (
                    <Link
                      href={`/events/${review.event_id}`}
                      className="underline no-underline hover:underline"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {review.event_title}
                    </Link>
                  ) : (
                    review.event_title
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {review.guru_review && <GuruBadge />}
          {review.flagged && <FlagBadge />}
          {isAdmin &&
            (review.published ? (
              <StateBadge tone="ok">Published</StateBadge>
            ) : (
              <StateBadge tone="pending">Unpublished</StateBadge>
            ))}
        </div>
      </div>

      {/* title + rating */}
      {review.review_title && (
        <h3
          className="font-heading mt-3"
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--color-dark)",
            letterSpacing: "-0.01em",
            margin: "12px 0 0",
          }}
        >
          {review.review_title}
        </h3>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <StarsInline rating={rating} />
        <span
          className="font-heading"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--color-dark)",
            letterSpacing: "-0.005em",
          }}
        >
          {rating > 0 ? rating.toFixed(2) : "—"}
        </span>
      </div>

      {/* body excerpt */}
      {review.review_body && (
        <p
          className="mt-2.5"
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--color-dark-light)",
            margin: "10px 0 0",
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {review.review_body}
        </p>
      )}
    </article>
  );
}

/* ── primitives ───────────────────────────────────────────────────── */

function SummaryTile({
  label,
  value,
  detail,
  gold,
  alert,
}: {
  label: string;
  value: string;
  detail?: string;
  gold?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className="rounded-xl bg-white p-3"
      style={{
        border: `1px solid ${alert ? "#fecaca" : "var(--color-border)"}`,
        background: alert ? "#fef2f2" : "#fff",
      }}
    >
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: ".12em",
          color: alert ? "#b91c1c" : "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      <div
        className="font-heading mt-1 flex items-baseline gap-1"
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: alert
            ? "#b91c1c"
            : gold
              ? "var(--color-dark)"
              : "var(--color-dark)",
          lineHeight: 1,
        }}
      >
        {gold && value !== "—" && (
          <GoldStarGlyph size={17} style={{ marginRight: 2 }} />
        )}
        {value}
        {detail && (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--color-text-faint)",
              letterSpacing: 0,
            }}
          >
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  icon,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tg-hover font-heading inline-flex cursor-pointer items-center gap-1.5 rounded-full transition-colors"
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: "5px 12px",
        background: active
          ? danger
            ? "var(--color-accent)"
            : "var(--color-dark)"
          : "var(--color-surface-alt)",
        color: active ? "#fff" : "var(--color-text-secondary)",
        border: `1px solid ${active ? (danger ? "var(--color-accent)" : "var(--color-dark)") : "transparent"}`,
        letterSpacing: "-0.005em",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function StarsInline({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i + 1 <= Math.floor(rating);
        const half =
          !filled && i + 1 === Math.ceil(rating) && rating - Math.floor(rating) >= 0.25;
        const color = filled || half ? "var(--color-gold)" : "#e2e8f0";
        return (
          <svg
            key={i}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={color}
            aria-hidden="true"
          >
            <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
          </svg>
        );
      })}
    </span>
  );
}

function GoldStarGlyph({
  size = 12,
  style,
}: {
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="var(--color-gold)"
      aria-hidden="true"
      style={style}
    >
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
    </svg>
  );
}

function GuruBadge() {
  return (
    <span
      className="font-heading inline-flex items-center gap-1 uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".08em",
        color: "#b91c1c",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      Guru
    </span>
  );
}

function FlagBadge() {
  return (
    <span
      className="font-heading inline-flex items-center gap-1 uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".08em",
        color: "#fff",
        background: "var(--color-accent)",
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      Flagged
    </span>
  );
}

function StateBadge({
  tone,
  children,
}: {
  tone: "ok" | "pending";
  children: React.ReactNode;
}) {
  const theme =
    tone === "ok"
      ? { bg: "#ecfdf5", color: "#15803d", border: "#bbf7d0" }
      : { bg: "#fef7ed", color: "#b45309", border: "#fed7aa" };
  return (
    <span
      className="font-heading inline-flex items-center uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".08em",
        color: theme.color,
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({
  hasFilters,
  isAdmin,
  totalCount,
  onReset,
}: {
  hasFilters: boolean;
  isAdmin: boolean;
  totalCount: number;
  onReset: () => void;
}) {
  const title = hasFilters
    ? "No reviews match your filters"
    : isAdmin
      ? totalCount === 0
        ? "No reviews on the platform yet"
        : "Nothing to show"
      : totalCount === 0
        ? "No reviews on your events yet"
        : "Nothing to show";
  const detail = hasFilters
    ? "Try clearing the search, rating, publish or flag filter."
    : isAdmin
      ? "As users write reviews, they'll show up here for moderation."
      : "Reviews will show up here after teams attend your events and post feedback.";
  return (
    <div
      className="rounded-2xl border border-dashed bg-white p-10 text-center"
      style={{ borderColor: "#cbd5e1" }}
    >
      <div className="mb-1.5" style={{ fontSize: 32 }} aria-hidden="true">
        ⭐
      </div>
      <div
        className="font-heading"
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "var(--color-dark)",
        }}
      >
        {title}
      </div>
      <div
        className="mt-1"
        style={{ fontSize: 13, color: "var(--color-text-muted)" }}
      >
        {detail}
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="tg-hover mt-4 cursor-pointer rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: "var(--color-dark)" }}
        >
          Clear filters
        </button>
      )}
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
