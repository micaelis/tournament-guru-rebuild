import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Filter-style chip used inside toolbars, tag lists, and category
 * pickers. Distinct from StatusPill: chips are interactive-looking and
 * larger; pills are semantic labels for state.
 */
export function Chip({
  active,
  onClick,
  as = "button",
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  as?: "button" | "span";
  children: ReactNode;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition";
  const state = active
    ? "border-slate-900 bg-slate-900 text-white"
    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400";
  const cls = cn(base, state, className);
  if (as === "span") return <span className={cls}>{children}</span>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
