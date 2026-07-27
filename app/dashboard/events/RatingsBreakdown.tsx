"use client";

import { StarRating } from "@/app/components/ui";
import { Icon } from "@/app/dashboard/icons";

export type BreakdownCategory = { label: string; value: number | null };

/**
 * The collapsible ratings breakdown used at BOTH levels of the events
 * list (tournament header + per-event row) so the two can never drift.
 * One composition: the three audience averages up top (Coach appears
 * only on premium surfaces; coach = red, attendee = amber — the app's
 * semantic pairing), then the category tiles under a BY CATEGORY
 * eyebrow. Coach Experience is a would-attend-again METER, not stars —
 * it mirrors the summary-band meter on the internal event details page.
 */
export function RatingsBreakdown({
  label,
  overall,
  coach,
  attendee,
  reviewCount,
  showCoach,
  wouldReturnPct,
  categories,
  onClose,
}: {
  /** Names the surface for screen readers ("Tournament ratings breakdown"). */
  label: string;
  overall: number | null;
  coach: number | null;
  attendee: number | null;
  reviewCount: number;
  /** Premium-only audiences: the Coach average + the Coach Experience meter. */
  showCoach: boolean;
  wouldReturnPct: number | null;
  categories: BreakdownCategory[];
  onClose: () => void;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className="relative rounded-xl border border-slate-200 bg-[#fafafa] p-4"
    >
      <button
        type="button"
        aria-label={`Close ${label.toLowerCase()}`}
        onClick={onClose}
        className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>

      <div className="flex flex-wrap items-start gap-x-10 gap-y-4 pr-8">
        <AudienceAverage
          label="Overall"
          labelClass="text-slate-500"
          valueClass="text-slate-900"
          starColor="#d4a017"
          value={overall}
          sub={`${reviewCount} verified ${reviewCount === 1 ? "review" : "reviews"}`}
        />
        {showCoach && (
          <AudienceAverage
            label="Coach"
            labelClass="text-red-600"
            valueClass="text-red-700"
            starColor="#dc2626"
            value={coach}
            sub={coach != null ? "verified coaches" : "no coach reviews yet"}
          />
        )}
        <AudienceAverage
          label="Attendee"
          labelClass="text-amber-600"
          valueClass="text-amber-700"
          starColor="#f59e0b"
          value={attendee}
          sub={attendee != null ? "all attendees" : "no attendee reviews yet"}
        />
      </div>

      <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
        By category
      </p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((cat) => (
          <div
            key={cat.label}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5"
          >
            <span className="text-[11.5px] font-semibold text-slate-600">
              {cat.label}
            </span>
            <span className="flex items-center gap-1.5">
              {cat.value != null && (
                <StarRating value={cat.value} size={12} showNumber={false} />
              )}
              <span className="font-[var(--font-heading)] text-[12px] font-extrabold text-slate-900">
                {formatAvg(cat.value)}
              </span>
            </span>
          </div>
        ))}
        {showCoach && (
          <div
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5"
            title={
              wouldReturnPct != null
                ? `${Math.round(wouldReturnPct)}% of verified coaches would attend again`
                : "No would-attend-again answers yet"
            }
          >
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-600">
              Coach Experience
              <span className="rounded-full bg-red-50 px-1.5 py-px text-[8.5px] font-extrabold uppercase tracking-wide text-red-700">
                Premium
              </span>
            </span>
            <span className="flex items-center gap-2">
              {wouldReturnPct != null && (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-slate-200"
                >
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, wouldReturnPct))}%`,
                    }}
                  />
                </span>
              )}
              <span className="font-[var(--font-heading)] text-[12px] font-extrabold text-slate-900">
                {wouldReturnPct != null ? `${Math.round(wouldReturnPct)}%` : "—"}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function AudienceAverage({
  label,
  labelClass,
  valueClass,
  starColor,
  value,
  sub,
}: {
  label: string;
  labelClass: string;
  valueClass: string;
  starColor: string;
  value: number | null;
  sub: string;
}) {
  return (
    <div>
      <p
        className={`text-[10px] font-extrabold uppercase tracking-[0.08em] ${labelClass}`}
      >
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={`font-[var(--font-heading)] text-[22px] font-extrabold leading-none tracking-tight ${valueClass}`}
        >
          {formatAvg(value)}
        </span>
        {value != null && (
          <StarRating
            value={value}
            size={13}
            showNumber={false}
            filledColor={starColor}
          />
        )}
      </div>
      <p className="mt-1 text-[11px] font-medium text-slate-500">{sub}</p>
    </div>
  );
}

function formatAvg(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(2);
}
