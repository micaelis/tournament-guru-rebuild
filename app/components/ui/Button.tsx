import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";
import { textLinkClass } from "./TextLink";

type Variant =
  | "primary"
  | "secondary"
  | "accent"
  | "ghost"
  | "danger"
  | "link"
  | "outline"
  | "soft";
type Size = "xs" | "sm" | "md" | "lg";

/**
 * The button variants used across the app. Primary = slate-900 filled
 * (the "commit" action) with a gentle lift on hover. Secondary = the
 * crisp ink-outline: transparent surface, 1.5px mid-slate border, bold
 * ink label — a real but subordinate action (Duplicate, Share, Save as
 * draft, per-section Edit links). Never a white or gray slab: the
 * legibility comes from the border weight, so it holds up on white
 * cards and the slate page wash alike (client call, supersedes the
 * S12.17 slate-fill tier). Accent = the brand-red fill, reserved for
 * premium/upgrade CTAs (the style guide's "upgrade CTA" color) — never
 * a general-purpose primary. Ghost = transparent with a soft border
 * (tertiary/bail-out). Danger = the unified red-tint destructive
 * treatment (red-50 fill, red-200 border — the RemoveIconButton
 * palette). Link = the canonical inline text-link look.
 *
 * Outline + soft are the settled two-tier secondary treatment (S12.35):
 * outline = white surface + 1px ink-navy border for container-level
 * actions (a tournament card's Add event / Edit tournament); soft = the
 * gray-blue fill with no border for the row-level actions subordinate
 * to them (a row's Edit / "…"). Rolled out on the ED events list only
 * for now — the app-wide secondary/ghost replacement is a follow-up.
 *
 * `loading` disables the button and swaps in the shared Spinner ahead
 * of the label — pass the pending flag from useActionState /
 * useFormStatus (or use FormButton, which wires it automatically).
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  loading = false,
  disabled,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  // Radius rides the size map (cn doesn't resolve utility conflicts, so
  // the base can't carry a rounded-* the xs tier needs to shrink).
  const base =
    "inline-flex items-center justify-center font-bold transition-all duration-150 ease-out disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none";
  const sizes: Record<Size, string> = {
    xs: "gap-1.5 rounded-lg px-2.5 py-1 text-[12px]",
    sm: "gap-2 rounded-xl px-3 py-1.5 text-[12.5px]",
    md: "gap-2 rounded-xl px-4 py-2.5 text-sm",
    lg: "gap-2 rounded-xl px-5 py-3 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-700 hover:-translate-y-px hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,.55)] active:translate-y-0 active:shadow-none disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:ring-2 focus-visible:ring-slate-900/40",
    secondary:
      "border-[1.5px] border-slate-400 bg-transparent text-slate-900 hover:border-slate-900 hover:bg-slate-900/[0.045] focus-visible:ring-2 focus-visible:ring-slate-900/20",
    accent:
      "bg-red-600 text-white hover:bg-red-700 hover:-translate-y-px hover:shadow-[0_6px_16px_-8px_rgba(220,38,38,.55)] active:translate-y-0 active:shadow-none disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:ring-2 focus-visible:ring-red-600/40",
    ghost:
      "border border-slate-200 bg-transparent text-slate-800 hover:border-slate-400 hover:bg-slate-900/[0.03]",
    danger:
      "border border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800",
    link: textLinkClass,
    outline:
      "border border-slate-700 bg-white text-slate-900 hover:border-slate-900 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900/25",
    soft: "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15",
  };
  return (
    <button
      {...rest}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
