import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Semantic tone. The five event states (draft/upcoming/ongoing/
 * concluded/canceled) each get a distinct tone; the neutral tones
 * (info/success/warning/danger) cover promo statuses, CSV statuses,
 * review status, and any future family that fits the same visual
 * grammar; premium/spotlight are the style guide's event badge pair
 * (solid red / violet outline). One primitive, no per-family
 * duplication.
 *
 * The "live" green (ongoing/success) runs a register deeper than the
 * other tints — emerald-100 wash, emerald-300 border — so a published/
 * active state stays legible at pill size on white and slate surfaces.
 *
 * Lifecycle colors (S12.36): Draft is the sky "blueprint" tint (never
 * amber — gold belongs to ratings — and never violet, which Spotlight
 * owns); Concluded is the crisp ink-outline (white surface, slate
 * border) instead of a gray slab, echoing the outline control chrome.
 */
export type PillTone =
  | "draft"
  | "upcoming"
  | "ongoing"
  | "concluded"
  | "canceled"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "premium"
  | "spotlight";

const TONE_STYLES: Record<PillTone, string> = {
  draft: "bg-sky-50 text-sky-700 border-sky-200",
  upcoming: "bg-blue-50 text-blue-800 border-blue-200",
  ongoing: "bg-emerald-100 text-emerald-800 border-emerald-300",
  concluded: "bg-white text-slate-700 border-slate-400",
  canceled: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-300",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  muted: "bg-slate-50 text-slate-500 border-slate-200",
  premium: "bg-red-600 text-white border-red-600",
  spotlight: "bg-violet-50 text-violet-600 border-violet-200",
};

/** Lifecycle tones carry a leading status dot — the dot is what makes
 *  the five states scan as one family in dense tables. */
const DOT_STYLES: Partial<Record<PillTone, string>> = {
  draft: "bg-sky-500",
  upcoming: "bg-blue-600",
  ongoing: "bg-emerald-600",
  concluded: "bg-slate-400",
  canceled: "bg-red-600",
};

/** Maps the DB's derived event display status text to a pill tone. */
export function eventStatusTone(
  status: "Draft" | "Upcoming" | "Ongoing" | "Concluded" | "Canceled",
): PillTone {
  switch (status) {
    case "Draft":
      return "draft";
    case "Upcoming":
      return "upcoming";
    case "Ongoing":
      return "ongoing";
    case "Concluded":
      return "concluded";
    case "Canceled":
      return "canceled";
  }
}

export function StatusPill({
  tone,
  children,
  className,
  compact = false,
}: {
  tone: PillTone;
  children: ReactNode;
  className?: string;
  /** The dense-table register (event-row badge sublines): tighter
   *  padding + 9px type. A prop, not caller class overrides — cn
   *  doesn't resolve utility conflicts. */
  compact?: boolean;
}) {
  const dot = DOT_STYLES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-bold uppercase",
        compact
          ? "gap-1 px-1.5 py-0 text-[9px] tracking-[0.07em]"
          : "gap-1.5 px-2.5 py-0.5 text-[11px] tracking-wider",
        TONE_STYLES[tone],
        className,
      )}
    >
      {dot && (
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      )}
      {children}
    </span>
  );
}
