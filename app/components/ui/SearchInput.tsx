import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Text search input with the magnifying-glass glyph — the one search-box
 * treatment app-wide. `className` styles the wrapper (widths / flex
 * behavior); every other prop spreads onto the underlying
 * `<input type="search">`, which always carries `tg-control` plus the
 * icon inset. `inputClassName` layers onto the input itself for shape
 * overrides (the events toolbar's pill rounding).
 */
export function SearchInput({
  className,
  inputClassName,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  className?: string;
  inputClassName?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="search"
        {...rest}
        className={cn("tg-control pl-10", inputClassName)}
      />
    </span>
  );
}
