"use client";

import { useEffect, useState } from "react";
import { Avatar, StarRating } from "@/app/components/ui";
import { formatRating } from "@/lib/reviews/shared";
import {
  getReviewerDetails,
  type ReviewerDetails,
} from "./reviewer-actions";

/**
 * Reviewer-details popup (spec §6.2): profile header, team info rows,
 * and the two rating pools side by side — Reviews as Verified Coach
 * (with-promo, red accents) vs Reviews as Attendee (without-promo,
 * yellow accents). Data loads through `getReviewerDetails`, which
 * passes through exactly what RLS lets the caller see — admins get
 * city/state + teams, EDs get the public-view identity — so missing
 * fields render as "—" rather than being fetched another way.
 */
export function ReviewerDetailsDialog({
  reviewId,
  onClose,
}: {
  reviewId: string;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<ReviewerDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReviewerDetails(reviewId).then((res) => {
      if (cancelled) return;
      if (res.details) setDetails(res.details);
      else setError(res.error ?? "Could not load reviewer.");
    });
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const name = details
    ? [details.firstName, details.lastName].filter(Boolean).join(" ") ||
      "Reviewer"
    : null;
  const location = details
    ? [details.city, details.stateAbbr].filter(Boolean).join(", ")
    : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reviewer details"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        {error ? (
          <p className="text-sm text-slate-600">{error}</p>
        ) : !details ? (
          <p className="text-sm text-slate-500">Loading reviewer…</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar src={details.photoUrl} name={name ?? "Reviewer"} size={48} />
              <div>
                <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
                  {name}
                </h3>
                <p className="text-[13px] text-slate-500">
                  {[location || "—", details.organization || "—"].join(" · ")}
                </p>
                <p className="text-[11px] font-bold text-slate-400">
                  {details.publishedCount} published review
                  {details.publishedCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Teams
              </p>
              {details.teams.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">—</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                  {details.teams.map((t) => (
                    <li key={t.slot}>
                      Team {t.slot}:{" "}
                      {[t.gender, t.age, t.level].filter(Boolean).join(" · ") ||
                        "—"}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PoolColumn
                title="Reviews as Verified Coach"
                accent="red"
                avg={details.coachPool.avg}
                count={details.coachPool.count}
              />
              <PoolColumn
                title="Reviews as Attendee"
                accent="yellow"
                avg={details.attendeePool.avg}
                count={details.attendeePool.count}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PoolColumn({
  title,
  accent,
  avg,
  count,
}: {
  title: string;
  accent: "red" | "yellow";
  avg: number | null;
  count: number;
}) {
  const accentText = accent === "red" ? "text-red-600" : "text-amber-600";
  const accentBorder = accent === "red" ? "border-red-200" : "border-amber-200";
  return (
    <div className={`rounded-xl border ${accentBorder} bg-white p-4`}>
      <p className={`text-[12px] font-bold ${accentText}`}>{title}</p>
      <div className="mt-2 flex items-center gap-2">
        <StarRating value={avg ?? 0} size={14} />
        <span className="text-sm font-extrabold text-slate-900">
          {formatRating(avg)}/5
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {count} review{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}
