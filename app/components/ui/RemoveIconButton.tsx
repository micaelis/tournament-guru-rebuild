import { cn } from "./cn";

/**
 * Compact destructive icon button for list rows (age groups, sponsors,
 * milestones, gallery images): a trash glyph on the soft red tint, so
 * "remove this row" reads at a glance without a text button competing
 * with the row's content. Always carries an aria-label ("Remove" by
 * default) — the glyph alone is never the accessible name.
 */
export function RemoveIconButton({
  label = "Remove",
  onClick,
  size = "md",
  className,
}: {
  /** Accessible name (and tooltip); include context in lists, e.g. "Remove sponsor 2". */
  label?: string;
  onClick: () => void;
  /** "md" aligns with control rows; "sm" with size-sm button clusters. */
  size?: "sm" | "md";
  className?: string;
}) {
  const glyph = size === "sm" ? 14 : 16;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-red-100 bg-red-50 text-red-600 transition-colors hover:border-red-200 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30",
        size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl",
        className,
      )}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
