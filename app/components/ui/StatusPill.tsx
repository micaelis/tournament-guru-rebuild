import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Semantic tone. The five event states (draft/upcoming/ongoing/
 * concluded/canceled) each get a distinct tone; the neutral tones
 * (info/success/warning/danger) cover promo statuses, CSV statuses,
 * review status, and any future family that fits the same visual
 * grammar. One primitive, no per-family duplication.
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
  | "muted";

const TONE_STYLES: Record<PillTone, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  upcoming: "bg-blue-50 text-blue-800 border-blue-200",
  ongoing: "bg-emerald-50 text-emerald-800 border-emerald-200",
  concluded: "bg-slate-200/70 text-slate-700 border-slate-300",
  canceled: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  muted: "bg-slate-50 text-slate-500 border-slate-200",
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
}: {
  tone: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        TONE_STYLES[tone],
        className,
      )}
    >
      {tone === "ongoing" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      )}
      {children}
    </span>
  );
}
