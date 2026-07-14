/** Numbered 3-step progress indicator for the onboarding wizard. */
export function Stepper({
  current,
  steps,
}: {
  current: number; // 1-based index of the active step
  steps: string[];
}) {
  return (
    <ol
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        listStyle: "none",
        padding: 0,
        margin: 0,
      }}
    >
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        const isLast = i === steps.length - 1;
        return (
          <li
            key={label}
            style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}
            aria-current={active ? "step" : undefined}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                  background:
                    done || active ? "var(--color-accent)" : "#fff",
                  color: done || active ? "#fff" : "var(--color-text-faint)",
                  border: `1.5px solid ${done || active ? "var(--color-accent)" : "var(--color-border)"}`,
                }}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stepNum
                )}
              </span>
              <span
                className="hidden sm:inline"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  color: active
                    ? "var(--color-dark)"
                    : "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </span>
            {!isLast && (
              <span
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 12px",
                  borderRadius: 2,
                  background: done ? "var(--color-accent)" : "var(--color-border)",
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
