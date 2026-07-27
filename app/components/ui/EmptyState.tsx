import type { ReactNode } from "react";
import { cn } from "./cn";

const STAR_POINTS =
  "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";

/**
 * The app-wide "no results / nothing yet" placeholder (S12.42): a white
 * card with a floating icon disc + optional red badge — never a dashed
 * border, never a bare red dot. `tone="gold"` is the celebratory
 * first-run weight (warm wash, float + twinkle accents, motion-gated);
 * the default slate tone is the calm no-matches weight. `compact` stays
 * the quiet one-liner for filtered-no-results rows.
 */
export function EmptyState({
  icon,
  badgeIcon,
  tone = "slate",
  title,
  body,
  action,
  secondary,
  className,
  compact = false,
}: {
  icon?: ReactNode;
  /** Small glyph inside the red accent badge on the disc's corner. */
  badgeIcon?: ReactNode;
  /** `gold` = first-run celebration; `slate` = calm no-matches. */
  tone?: "gold" | "slate";
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  className?: string;
  /** Quieter variant for filtered-no-results ("nothing matched") —
   * no icon, plain title — vs. the illustrated first-run state. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center",
          className,
        )}
      >
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        {body && (
          <p className="mt-1 max-w-md text-sm text-slate-500">{body}</p>
        )}
        {(action || secondary) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {action}
            {secondary}
          </div>
        )}
      </div>
    );
  }

  const gold = tone === "gold";
  const disc = icon ?? (
    <svg
      viewBox="0 0 24 24"
      className={gold ? "h-8 w-8" : "h-7 w-7"}
      fill={gold ? "#f59e0b" : "#cbd5e1"}
      aria-hidden
    >
      <polygon points={STAR_POINTS} />
    </svg>
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_34px_-22px_rgba(15,23,42,0.18)]",
        gold ? "py-16" : "py-14",
        className,
      )}
    >
      {gold && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-44"
          style={{
            background:
              "radial-gradient(340px 150px at 50% 0%, rgba(245,158,11,.09), transparent 72%)",
          }}
        />
      )}

      <div className="relative w-fit">
        {gold ? (
          <span className="tg-floaty grid h-[74px] w-[74px] place-items-center rounded-2xl bg-gradient-to-br from-amber-50 to-white text-amber-500 shadow-[0_16px_32px_-16px_rgba(245,158,11,0.5)] ring-1 ring-amber-200/70">
            {disc}
          </span>
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            {disc}
          </span>
        )}
        {badgeIcon && (
          <span
            className={cn(
              "absolute grid place-items-center rounded-full bg-red-600 text-white shadow-[0_6px_14px_-4px_rgba(220,38,38,0.55)]",
              gold ? "-right-2.5 -top-2.5 h-7 w-7" : "-right-1.5 -top-1.5 h-6 w-6",
            )}
          >
            {badgeIcon}
          </span>
        )}
        {gold && (
          <>
            <svg
              viewBox="0 0 24 24"
              className="tg-twinkle absolute -left-6 top-1 h-3 w-3"
              fill="#fbbf24"
              aria-hidden
            >
              <polygon points={STAR_POINTS} />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="tg-twinkle tg-twinkle-2 absolute -right-7 bottom-2 h-2.5 w-2.5"
              fill="#fca5a5"
              aria-hidden
            >
              <polygon points={STAR_POINTS} />
            </svg>
          </>
        )}
      </div>

      <h3
        className={cn(
          "relative mt-6 font-[var(--font-heading)] font-extrabold tracking-tight text-slate-900",
          gold ? "text-[19px]" : "text-[17px]",
        )}
      >
        {title}
      </h3>
      {body && (
        <p className="relative mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-slate-600">
          {body}
        </p>
      )}
      {(action || secondary) && (
        <div
          className={cn(
            "relative mt-6 flex items-center justify-center",
            gold ? "flex-col gap-3.5" : "flex-wrap gap-x-5 gap-y-3",
          )}
        >
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}
