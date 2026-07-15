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

export function CardHeader({
  title,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-slate-100 p-5",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-1 font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          {title}
        </h3>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
