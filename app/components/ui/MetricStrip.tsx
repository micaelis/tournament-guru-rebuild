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
        "rounded-xl border border-slate-150 bg-slate-50/80 p-3",
        empty && "opacity-50",
        className,
      )}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="mt-1.5">
        <StarRating value={value ?? 0} count={count} size={13} />
      </div>
      {hint && (
        <p className="mt-1 text-[11px] font-medium text-slate-500">{hint}</p>
      )}
    </div>
  );
}

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
              <p className="text-[13px] font-bold text-slate-700">{title}</p>
            )}
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
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
          className="grid gap-2.5"
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
