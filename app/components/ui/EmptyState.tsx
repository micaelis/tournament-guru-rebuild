import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Illustrated empty state. The scoping specs say "a nice placeholder"
 * multiple times and to reuse the same component everywhere; this is
 * that component. Icon is optional (renders a red round dot when omitted
 * to still give the block visual weight); action + secondary let the
 * caller drop CTAs in the same slot.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
  className,
  compact = false,
}: {
  icon?: ReactNode;
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
          "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center",
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
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
        {icon ?? <span className="h-3 w-3 rounded-full bg-red-500" />}
      </span>
      <h3 className="mt-4 font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
        {title}
      </h3>
      {body && (
        <p className="mt-2 max-w-md text-sm text-slate-600">{body}</p>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}
