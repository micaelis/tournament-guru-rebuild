"use client";

export type PillOption = { value: string; label: string; sublabel?: string };

/**
 * Accessible radio group rendered as selectable pills. Controlled via
 * value/onChange; also emits a hidden input so it works inside plain
 * <form action={serverAction}> submissions.
 */
export function SegmentedPills({
  name,
  options,
  value,
  onChange,
  columns = 3,
  ariaLabel,
}: {
  name: string;
  options: PillOption[];
  value: string;
  onChange: (v: string) => void;
  columns?: number;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 10,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 12,
              cursor: "pointer",
              background: active ? "#fef2f2" : "#fff",
              border: `1.5px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
              color: active ? "var(--color-accent-dark)" : "var(--color-dark)",
              transition: "border-color 0.15s ease, background 0.15s ease",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>{opt.label}</span>
            {opt.sublabel && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: active ? "var(--color-accent)" : "var(--color-text-muted)",
                }}
              >
                {opt.sublabel}
              </span>
            )}
          </button>
        );
      })}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
