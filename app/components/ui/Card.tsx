import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * The base content container used across the dashboard. Matches the
 * tgredesign HybridCard visual: white surface, slate-200 border,
 * radius 16, border-only hover treatment (no shadow, no lift). Compose
 * with your own padding.
 */
export function Card({
  className,
  children,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white transition-colors hover:border-slate-400",
        className,
      )}
    >
      {children}
    </div>
  );
}
