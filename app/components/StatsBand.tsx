type StatsData = {
  eventsCount: number;
  reviewsCount: number;
  tournamentsCount: number;
};

const STATS_CONFIG = [
  {
    key: "events" as const,
    label: "tournaments",
    tint: {
      bg: "#fff1f2",
      border: "#fecdd3",
      iconBg: "var(--color-accent)",
    },
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M6 4h12v5a6 6 0 01-12 0V4zM12 15v4M8 21h8" />
      </svg>
    ),
  },
  {
    key: "reviews" as const,
    label: "reviews",
    tint: {
      bg: "#d6e3fb",
      border: "#a9c5f2",
      iconBg: "#004dff",
    },
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
      </svg>
    ),
  },
  {
    key: "tournaments" as const,
    label: "event profiles",
    tint: {
      bg: "#ecfdf5",
      border: "#bbf7d0",
      iconBg: "#15803d",
    },
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
];

export function StatsBand({ stats }: { stats: StatsData }) {
  const values = {
    events: stats.eventsCount,
    reviews: stats.reviewsCount,
    tournaments: stats.tournamentsCount,
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {STATS_CONFIG.map((s) => (
        <div
          key={s.key}
          className="inline-flex items-center gap-2.5 rounded-full"
          style={{
            background: s.tint.bg,
            border: `1px solid ${s.tint.border}`,
            padding: "7px 16px 7px 8px",
          }}
        >
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
            style={{
              width: 30,
              height: 30,
              background: s.tint.iconBg,
            }}
          >
            {s.icon}
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <b
              className="font-heading text-dark"
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {values[s.key].toLocaleString()}
            </b>
            <span
              className="text-dark"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {s.label}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function StatsBandSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="inline-flex animate-pulse items-center gap-2.5 rounded-full"
          style={{
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            padding: "7px 16px 7px 8px",
          }}
        >
          <div
            className="rounded-full bg-gray-300"
            style={{ width: 30, height: 30 }}
          />
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
