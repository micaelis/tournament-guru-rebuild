import type React from "react";

/* Key dates & deadlines timeline — the premium event-page section,
   shared verbatim by the public event page (app/(site)/events/[id])
   and the internal ED details page (app/dashboard/events/[id]) so the
   two surfaces can never drift. Pure presentational module: no hooks,
   no handlers — renders server-side on the dashboard and inside the
   public page's client tree alike.

   Rows are the ED's entered milestones plus a derived "Tournament
   Kicks Off" anchor (= the event's start date — never a stored row,
   matching the form's pinned read-only anchor). Status is date-derived,
   never stored. */

export type KeyDateMilestone = {
  title: string;
  milestone_date: string | null;
  description: string | null;
  sort_order?: number | null;
};

export type KeyDateStatus = "done" | "next" | "upcoming" | "event";

export type KeyDateRow = {
  title: string;
  description: string | null;
  dateIso: string | null;
  kind: KeyDateStatus;
};

export const KICKOFF_TITLE = "Tournament Kicks Off";

/**
 * Build the display rows: ED milestones + the derived kick-off, sorted
 * by date (dateless milestones trail as TBD). Status, judged against
 * local midnight: a past milestone is Done, every milestone on the
 * soonest still-to-come date is Next up, later ones are Upcoming, and
 * the kick-off always reads Event day. Returns [] when the ED entered
 * no milestones — the kick-off alone doesn't warrant the card.
 */
export function buildKeyDateRows(
  milestones: KeyDateMilestone[],
  startDate: string | null,
  todayIso: string = localTodayIso(),
): KeyDateRow[] {
  const entered = milestones
    .filter((m) => typeof m.title === "string" && m.title.trim() !== "")
    .map((m, i) => ({
      title: m.title.trim(),
      description: m.description?.trim() || null,
      dateIso: isoDateOnly(m.milestone_date),
      order: m.sort_order ?? i,
    }));
  if (entered.length === 0) return [];

  const nextDate = entered
    .map((m) => m.dateIso)
    .filter((d): d is string => d != null && d >= todayIso)
    .reduce<string | null>((a, b) => (a == null || b < a ? b : a), null);

  const rows: Array<KeyDateRow & { order: number }> = entered.map((m) => ({
    ...m,
    kind:
      m.dateIso != null && m.dateIso < todayIso
        ? "done"
        : m.dateIso != null && m.dateIso === nextDate
          ? "next"
          : "upcoming",
  }));

  const kickoff = isoDateOnly(startDate);
  if (kickoff) {
    // Sorts after a same-day milestone: the kick-off closes the day.
    rows.push({
      title: KICKOFF_TITLE,
      description: null,
      dateIso: kickoff,
      order: Number.MAX_SAFE_INTEGER,
      kind: "event",
    });
  }

  rows.sort((a, b) => {
    if (a.dateIso == null || b.dateIso == null) {
      if (a.dateIso != null) return -1; // dated before TBD
      if (b.dateIso != null) return 1;
    } else if (a.dateIso !== b.dateIso) {
      return a.dateIso < b.dateIso ? -1 : 1;
    }
    return a.order - b.order;
  });

  return rows.map(({ title, description, dateIso, kind }) => ({
    title,
    description,
    dateIso,
    kind,
  }));
}

/* ── renderer ─────────────────────────────────────────────────────── */

export function KeyDatesTimeline({ rows }: { rows: KeyDateRow[] }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {rows.map((row, i) => (
        <li
          key={`${row.title}-${row.dateIso ?? "tbd"}-${i}`}
          className="grid items-start"
          style={{
            gridTemplateColumns: "64px 24px minmax(0, 1fr) auto",
            gap: 14,
            paddingBottom: i === rows.length - 1 ? 0 : 22,
          }}
        >
          <div style={{ textAlign: "right", paddingTop: 2 }}>
            <div
              className="font-heading"
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--color-dark)",
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              {row.dateIso ? fmtMonthDay(row.dateIso) : "TBD"}
            </div>
            {row.dateIso && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginTop: 2,
                }}
              >
                {fmtWeekday(row.dateIso)}
              </div>
            )}
          </div>

          <div className="relative flex justify-center self-stretch">
            {i !== rows.length - 1 && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 11,
                  top: 26,
                  bottom: -22,
                  width: 2,
                  background: "var(--color-border)",
                  borderRadius: 1,
                }}
              />
            )}
            <MilestoneDot kind={row.kind} />
          </div>

          <div className="min-w-0">
            <div
              className="font-heading"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-dark)",
                letterSpacing: "-0.005em",
                lineHeight: 1.25,
              }}
            >
              {row.title}
            </div>
            {row.description && (
              <div
                style={{
                  marginTop: 3,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--color-text-muted)",
                  lineHeight: 1.45,
                }}
              >
                {row.description}
              </div>
            )}
          </div>

          <div style={{ paddingTop: 2 }}>
            <StatusBadge kind={row.kind} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const BADGE_LABEL: Record<KeyDateStatus, string> = {
  done: "Done",
  next: "Next up",
  upcoming: "Upcoming",
  event: "Event day",
};

const BADGE_STYLE: Record<KeyDateStatus, React.CSSProperties> = {
  done: { background: "#d1fae5", color: "#065f46", borderColor: "#6ee7b7" },
  next: { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" },
  upcoming: { background: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" },
  event: {
    background: "var(--color-accent)",
    color: "#fff",
    borderColor: "var(--color-accent)",
  },
};

function StatusBadge({ kind }: { kind: KeyDateStatus }) {
  return (
    <span
      className="font-heading inline-flex items-center whitespace-nowrap rounded-full uppercase"
      style={{
        gap: 5,
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".05em",
        padding: "3.5px 9px",
        border: "1px solid transparent",
        ...BADGE_STYLE[kind],
      }}
    >
      {kind === "done" && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12l4 4 10-11" />
        </svg>
      )}
      {kind === "next" && (
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: 9999,
            background: "var(--color-accent)",
            flex: "none",
          }}
        />
      )}
      {BADGE_LABEL[kind]}
    </span>
  );
}

export function MilestoneDot({ kind }: { kind: KeyDateStatus }) {
  if (kind === "done") {
    return (
      <span
        aria-hidden
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 24,
          height: 24,
          background: "#16a34a",
          border: "3px solid #fff",
          boxShadow: "0 0 0 1px #dcfce7",
          color: "#fff",
          zIndex: 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l4 4 10-11" />
        </svg>
      </span>
    );
  }
  if (kind === "event") {
    return (
      <span
        aria-hidden
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 24,
          height: 24,
          background: "var(--color-accent)",
          border: "3px solid #fff",
          boxShadow: "0 0 0 3px rgba(220,38,38,.16)",
          color: "#fff",
          zIndex: 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </span>
    );
  }
  if (kind === "next") {
    return (
      <span
        aria-hidden
        className="relative inline-block shrink-0 rounded-full"
        style={{
          width: 24,
          height: 24,
          background: "#fff",
          border: "3px solid var(--color-accent)",
          boxShadow: "0 0 0 3px rgba(220,38,38,.14)",
          zIndex: 1,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0 rounded-full"
      style={{
        width: 24,
        height: 24,
        background: "#fff",
        border: "3px solid var(--color-border)",
        zIndex: 1,
      }}
    />
  );
}

/* ── date helpers (US-locale, timezone-safe date-only parsing) ────── */

function isoDateOnly(v: string | null | undefined): string | null {
  if (!v) return null;
  return /^(\d{4}-\d{2}-\d{2})/.exec(v)?.[1] ?? null;
}

function localTodayIso(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function parseDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function fmtMonthDay(iso: string): string {
  const d = parseDateOnly(iso);
  if (!d) return "TBD";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtWeekday(iso: string): string {
  const d = parseDateOnly(iso);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { weekday: "long" });
}
