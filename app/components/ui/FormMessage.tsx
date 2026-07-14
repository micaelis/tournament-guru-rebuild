type Tone = "error" | "success" | "info";

const TONES: Record<
  Tone,
  { bg: string; border: string; color: string; icon: React.ReactNode }
> = {
  error: {
    bg: "#fef2f2",
    border: "#fecaca",
    color: "#b91c1c",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  success: {
    bg: "#ecfdf5",
    border: "#bbf7d0",
    color: "#15803d",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  info: {
    bg: "#fff7ed",
    border: "#fed7aa",
    color: "#c2410c",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

/** Inline status banner for form errors / success / guidance. */
export function FormMessage({
  tone = "error",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        color: t.color,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>}
        <div style={{ fontWeight: 500 }}>{children}</div>
      </div>
    </div>
  );
}
