import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

/**
 * The three-and-a-half button variants used across the app. Primary =
 * slate-900 filled (the "commit" action). Ghost = white with border
 * (secondary). Danger = red-tinted ghost for destructive confirms.
 * Link = flat, red-accent inline action.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none";
  const sizes: Record<Size, string> = {
    sm: "px-3 py-1.5 text-[12.5px]",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-900/40",
    ghost:
      "border border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
    danger:
      "border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-400",
    link: "text-red-600 hover:text-red-700 underline underline-offset-2",
  };
  return (
    <button
      {...rest}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}
