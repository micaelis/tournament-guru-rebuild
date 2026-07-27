import type { ReactNode } from "react";
import { cn } from "./cn";

type HeaderCountChipProps = {
  /** Small stroke glyph rendered inside the circular medallion. */
  icon: ReactNode;
  count: number;
  label: string;
  className?: string;
};

/**
 * The app-wide header-count treatment: a white pill beside a page
 * title — circular slate medallion, the count in the heading font,
 * a quiet label. Page-header counts only; inline sub-counts (e.g.
 * per-group "3 events" lines) stay plain text.
 */
export function HeaderCountChip({
  icon,
  count,
  label,
  className,
}: HeaderCountChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white py-1 pl-[5px] pr-3 text-xs font-semibold text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-slate-100 text-slate-500">
        {icon}
      </span>
      <span className="font-[var(--font-heading)] text-[12.5px] font-extrabold text-slate-900">
        {count}
      </span>{" "}
      {label}
    </span>
  );
}
