"use client";

import { useState, type ReactNode } from "react";
import { StarRating } from "./StarRating";
import { cn } from "./cn";

export type MetricTileData = {
  label: string;
  value: number | null;
  count?: number;
  hint?: string;
};

/**
 * One metric tile — yellow-fill tone matches the ED dashboard mock
 * ("nice yellow card fill for average of overall rating"). Renders
 * a compact star row + two-decimal average + review count.
 */
export function MetricTile({
  label,
  value,
  count,
  hint,
  className,
}: MetricTileData & { className?: string }) {
  const empty = value === null || value === undefined;
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-100 bg-amber-50/70 p-3",
        empty && "opacity-60",
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900/70">
        {label}
      </p>
      <div className="mt-1.5">
        <StarRating value={value ?? 0} count={count} size={13} />
      </div>
      {hint && (
        <p className="mt-1 text-[11px] font-medium text-amber-900/60">{hint}</p>
      )}
    </div>
  );
}

/**
 * The horizontal metric row on the ED Events page (6 or 9 tiles),
 * with an optional collapse chevron. The 9-tile tournament strip
 * shows Overall/Coach/Attendee first, then the 6 categories; the
 * 6-tile event strip shows just the categories.
 */
export function MetricStrip({
  tiles,
  collapsible = true,
  defaultOpen = true,
  title,
  action,
  className,
}: {
  tiles: MetricTileData[];
  collapsible?: boolean;
  defaultOpen?: boolean;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("space-y-3", className)}>
      {(title || collapsible || action) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {title && (
              <p className="text-[13px] font-bold text-slate-800">{title}</p>
            )}
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400"
              >
                {open ? "Hide" : "Show"}
              </button>
            )}
          </div>
          {action}
        </div>
      )}
      {open && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
          }}
        >
          {tiles.map((t) => (
            <MetricTile key={t.label} {...t} />
          ))}
        </div>
      )}
    </section>
  );
}
