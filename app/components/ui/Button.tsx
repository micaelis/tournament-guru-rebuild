import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";
import { textLinkClass } from "./TextLink";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

/**
 * The button variants used across the app. Primary = slate-900 filled
 * (the "commit" action) with a gentle lift on hover. Secondary = soft
 * slate fill — a real but subordinate action (Save as draft, add-row
 * CTAs) that must read as a button against white form cards, where the
 * bordered ghost disappears into the inputs around it. Ghost = white
 * with border (tertiary/bail-out). Danger = red-tinted ghost for
 * destructive confirms. Link = the canonical inline text-link look.
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
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-150 ease-out disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none";
  const sizes: Record<Size, string> = {
    sm: "px-3 py-1.5 text-[12.5px]",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-700 hover:-translate-y-px hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,.55)] active:translate-y-0 active:shadow-none disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:ring-2 focus-visible:ring-slate-900/40",
    secondary:
      "border border-slate-200 bg-slate-100 text-slate-900 hover:border-slate-300 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-900/20",
    ghost:
      "border border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
    danger:
      "border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-400",
    link: textLinkClass,
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
