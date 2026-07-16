const STAR_PATH =
  "M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z";

export function Stars({
  rating,
  count,
  size = 14,
}: {
  rating: number;
  count?: number | null;
  size?: number;
}) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.4 && rating - full < 0.9;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < full;
          const half = i === full && hasHalf;
          const color = filled || half ? "var(--color-gold)" : "#e2e8f0";
          return (
            <svg
              key={i}
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={color}
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d={STAR_PATH} />
            </svg>
          );
        })}
      </span>
      <span
        className="font-heading text-[13px] font-extrabold text-dark"
        style={{ letterSpacing: "-0.01em" }}
      >
        {rating.toFixed(1)}
      </span>
      {count != null && (
        <span className="text-xs font-semibold text-text-faint">
          ({count} {count === 1 ? "review" : "reviews"})
        </span>
      )}
    </span>
  );
}
