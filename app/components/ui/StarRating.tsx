"use client";

import { useState } from "react";
import { cn } from "./cn";

/**
 * Star rating primitive.
 *
 * Two modes:
 * - readOnly (default): display value with half-star precision, plus a
 *   two-decimal number to the right + optional count. Used everywhere
 *   inside the dashboard's metric tiles + review cards.
 * - interactive: whole-star selector (1..5). Used on the public review
 *   form (Slice 2). onChange fires with the chosen integer.
 *
 * The star SVG is the single tgredesign path (from cards.jsx) so
 * every rendering across the app looks identical.
 */
export function StarRating({
  value,
  count,
  size = 15,
  interactive = false,
  onChange,
  filledColor = "#f59e0b",
  emptyColor = "#e2e8f0",
  className,
  showNumber = true,
}: {
  value: number;
  count?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
  filledColor?: string;
  emptyColor?: string;
  className?: string;
  showNumber?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const displayed = interactive && hover !== null ? hover : value;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex items-center gap-[2px]">
        {Array.from({ length: 5 }, (_, i) => {
          const n = i + 1;
          const filled = displayed >= n;
          const half = !filled && displayed >= n - 0.5;
          return (
            <Star
              key={n}
              size={size}
              tone={filled ? "full" : half ? "half" : "empty"}
              filledColor={filledColor}
              emptyColor={emptyColor}
              onClick={interactive ? () => onChange?.(n) : undefined}
              onMouseEnter={interactive ? () => setHover(n) : undefined}
              onMouseLeave={interactive ? () => setHover(null) : undefined}
            />
          );
        })}
      </span>
      {showNumber && (
        <>
          <span className="font-[var(--font-heading)] text-[13px] font-extrabold text-slate-900">
            {formatRating(value)}
          </span>
          {typeof count === "number" && (
            <span className="text-[12px] font-semibold text-slate-500">
              ({count.toLocaleString()})
            </span>
          )}
        </>
      )}
    </span>
  );
}

function formatRating(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(2);
}

function Star({
  size,
  tone,
  filledColor,
  emptyColor,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  size: number;
  tone: "full" | "half" | "empty";
  filledColor: string;
  emptyColor: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const id = `star-half-${filledColor.replace("#", "")}-${emptyColor.replace("#", "")}`;
  const fill =
    tone === "full" ? filledColor : tone === "half" ? `url(#${id})` : emptyColor;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: onClick ? "pointer" : "default" }}
      aria-hidden="true"
    >
      {tone === "half" && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor={filledColor} />
            <stop offset="50%" stopColor={emptyColor} />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z"
        fill={fill}
      />
    </svg>
  );
}
