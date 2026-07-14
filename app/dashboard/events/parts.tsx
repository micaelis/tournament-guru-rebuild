"use client";

/* EventsManager — client-side orchestrator for the /dashboard/events page.
   Mirrors the intent of the Bubble `dashboard-events A` reusable: a
   searchable, filterable list of events the current user manages, with
   quick stat tiles at the top and per-row actions.

   Role behavior:
     * event_director → title says "Your Events", primary CTA is "Create event"
     * admin          → title says "All Events", primary CTA is "New event"

   All filtering, search and status counting happens client-side against the
   pre-fetched list (RLS scoped it correctly on the server). */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardProfile } from "@/lib/supabase/session";
import type { DashboardEventRow } from "@/lib/supabase/queries";

type StatusFilter = "all" | "draft" | "open" | "concluded" | "cancelled";

const STATUS_LABELS: Record<Exclude<StatusFilter, "all">, string> = {
  draft: "Draft",
  open: "Open",
  concluded: "Concluded",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<
  Exclude<StatusFilter, "all">,
  { bg: string; color: string; border: string; dot: string }
> = {
  draft: {
    bg: "#f1f5f9",
    color: "#475569",
    border: "#e2e8f0",
    dot: "#94a3b8",
  },
  open: {
    bg: "#ecfdf5",
    color: "#15803d",
    border: "#bbf7d0",
    dot: "#16a34a",
  },
  concluded: {
    bg: "#f5f0e8",
    color: "#78716c",
    border: "#e7dfd0",
    dot: "#a8a29e",
  },
  cancelled: {
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
    dot: "#dc2626",
  },
};

export function EventsManager({
  events,
  error,
  role,
}: {
  events: DashboardEventRow[];
  error: string | null;
  role: DashboardProfile["user_type"];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [premiumOnly, setPremiumOnly] = useState(false);

  const isAdmin = role === "admin";

  // Precompute derived rows once for both counts + filter output.
  const decorated = useMemo(
    () =>
      events.map((e) => {
        const effectiveStatus: Exclude<StatusFilter, "all"> =
          e.status === "cancelled"
            ? "cancelled"
            : e.status === "concluded" ||
                (!!e.end_date && new Date(e.end_date) < new Date())
              ? "concluded"
              : e.status === "open"
                ? "open"
                : "draft";
        return { row: e, status: effectiveStatus };
      }),
    [events],
  );

  const counts = useMemo(() => {
    const c: Record<Exclude<StatusFilter, "all">, number> = {
      draft: 0,
      open: 0,
      concluded: 0,
      cancelled: 0,
    };
    for (const { status: s } of decorated) c[s] += 1;
    return c;
  }, [decorated]);

  const premiumCount = useMemo(
    () => events.filter((e) => e.premium).length,
    [events],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decorated.filter(({ row, status: rowStatus }) => {
      if (status !== "all" && rowStatus !== status) return false;
      if (premiumOnly && !row.premium) return false;
      if (!q) return true;
      const hay = [
        row.title,
        row.host_club ?? "",
        row.location_text ?? "",
        row.state ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [decorated, query, status, premiumOnly]);

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="shrink-0 rounded-full"
              style={{
                width: 6,
                height: 6,
                background: "var(--color-accent)",
              }}
            />
            <span
              className="font-heading uppercase"
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: ".14em",
                color: "var(--color-text-secondary)",
              }}
            >
              {isAdmin ? "Admin · Events" : "Your dashboard"}
            </span>
          </div>
          <h1
            className="font-heading"
            style={{
              fontSize: "clamp(24px, 3vw, 30px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "var(--color-dark)",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {isAdmin ? "All Events" : "Your Events"}
          </h1>
          <p
            className="mt-2 max-w-2xl"
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--color-text-secondary)",
              margin: "8px 0 0",
            }}
          >
            {isAdmin
              ? "Every event on the platform, most recently updated first. Filter by status or search by title, host or location."
              : "Every event you host. Track registrations, respond to reviews, and promote your listings to Featured."}
          </p>
        </div>

        {/* Placeholder CTA — the create-event flow isn't wired up yet;
            surface it disabled with a note so it's obvious it's coming. */}
        <button
          type="button"
          disabled
          className="tg-btn-primary font-heading inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-white"
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            background: "var(--color-accent)",
            border: "1px solid transparent",
            cursor: "not-allowed",
            opacity: 0.6,
          }}
          title="Create-event flow coming soon"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {isAdmin ? "New event" : "Create event"}
        </button>
      </header>

      {/* ── Stat tiles ─────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Total"
          value={events.length}
          onClick={() => setStatus("all")}
          active={status === "all"}
        />
        <StatTile
          label="Open"
          value={counts.open}
          onClick={() => setStatus("open")}
          active={status === "open"}
          tone="open"
        />
        <StatTile
          label="Draft"
          value={counts.draft}
          onClick={() => setStatus("draft")}
          active={status === "draft"}
          tone="draft"
        />
        <StatTile
          label="Featured"
          value={premiumCount}
          onClick={() => setPremiumOnly((v) => !v)}
          active={premiumOnly}
          tone="premium"
        />
      </div>

      {/* ── Toolbar (search + status chips) ───────────────────────────── */}
      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div
          className="tg-focus-field flex h-10 min-w-[200px] flex-[1_1_260px] items-center gap-2 rounded-lg bg-white pl-2 pr-1"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "var(--color-text-muted)" }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            aria-label="Search events"
            placeholder={
              isAdmin
                ? "Search by title, host or location"
                : "Search your events"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-0 bg-transparent p-0 text-[14px] outline-none"
            style={{ color: "var(--color-dark)" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full"
              style={{ color: "var(--color-text-faint)" }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip
            label="All"
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
          {(Object.keys(STATUS_LABELS) as Exclude<StatusFilter, "all">[]).map(
            (s) => (
              <StatusChip
                key={s}
                label={STATUS_LABELS[s]}
                active={status === s}
                onClick={() => setStatus(s)}
                tone={STATUS_TONE[s]}
                count={counts[s]}
              />
            ),
          )}
        </div>
      </div>

      {/* ── Error / empty / table ─────────────────────────────────────── */}
      {error && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-[13px]"
          style={{
            borderColor: "var(--color-accent)",
            background: "#fef2f2",
            color: "var(--color-accent-dark)",
          }}
          role="alert"
        >
          Couldn&rsquo;t load events: {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          hasFilters={query.length > 0 || status !== "all" || premiumOnly}
          isAdmin={isAdmin}
          totalCount={events.length}
          onReset={() => {
            setQuery("");
            setStatus("all");
            setPremiumOnly(false);
          }}
        />
      ) : (
        <EventsTable rows={filtered} isAdmin={isAdmin} />
      )}
    </div>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  onClick,
  active,
  tone,
}: {
  label: string;
  value: number;
  onClick: () => void;
  active: boolean;
  tone?: "open" | "draft" | "premium";
}) {
  const themeMap: Record<
    string,
    { activeBg: string; activeBorder: string; accent: string }
  > = {
    open: {
      activeBg: "#ecfdf5",
      activeBorder: "#bbf7d0",
      accent: "#16a34a",
    },
    draft: {
      activeBg: "#f1f5f9",
      activeBorder: "#cbd5e1",
      accent: "#64748b",
    },
    premium: {
      activeBg: "#fff1f2",
      activeBorder: "#fecdd3",
      accent: "var(--color-accent)",
    },
    default: {
      activeBg: "var(--color-surface-alt)",
      activeBorder: "var(--color-dark)",
      accent: "var(--color-dark)",
    },
  };
  const t = tone ? themeMap[tone] : themeMap.default;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="tg-hover cursor-pointer rounded-xl bg-white p-3 text-left transition-colors"
      style={{
        border: `1px solid ${active ? t.activeBorder : "var(--color-border)"}`,
        background: active ? t.activeBg : "#fff",
        boxShadow: active
          ? "0 2px 8px -2px rgba(15,23,42,.15)"
          : "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: ".12em",
          color: active ? t.accent : "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      <div
        className="font-heading mt-1"
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "var(--color-dark)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </button>
  );
}

/* ── Status chip ───────────────────────────────────────────────────── */

function StatusChip({
  label,
  active,
  onClick,
  tone,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: (typeof STATUS_TONE)[keyof typeof STATUS_TONE];
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tg-hover font-heading cursor-pointer inline-flex items-center gap-1.5 rounded-full transition-colors"
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "-0.005em",
        padding: "5px 12px",
        background: active
          ? tone?.bg ?? "var(--color-dark)"
          : "var(--color-surface-alt)",
        color: active
          ? tone?.color ?? "#fff"
          : "var(--color-text-secondary)",
        border: `1px solid ${active ? tone?.border ?? "var(--color-dark)" : "transparent"}`,
      }}
    >
      {tone && (
        <span
          aria-hidden="true"
          className="rounded-full"
          style={{
            width: 5,
            height: 5,
            background: tone.dot,
          }}
        />
      )}
      {label}
      {count != null && (
        <span
          className="ml-0.5"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: active
              ? tone?.color ?? "#fff"
              : "var(--color-text-faint)",
            opacity: active ? 0.7 : 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Table (desktop) + cards (mobile) ──────────────────────────────── */

function EventsTable({
  rows,
  isAdmin,
}: {
  rows: { row: DashboardEventRow; status: Exclude<StatusFilter, "all"> }[];
  isAdmin: boolean;
}) {
  return (
    <>
      {/* Desktop / tablet: table view */}
      <div
        className="hidden overflow-hidden rounded-xl bg-white md:block"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--color-surface-alt)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <HeaderCell>Event</HeaderCell>
                <HeaderCell>Dates</HeaderCell>
                <HeaderCell>Location</HeaderCell>
                <HeaderCell align="center">Status</HeaderCell>
                <HeaderCell align="right">Reviews</HeaderCell>
                <HeaderCell align="right">Actions</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, status: rowStatus }, i) => (
                <TableRow
                  key={row.id}
                  event={row}
                  status={rowStatus}
                  isAdmin={isAdmin}
                  striped={i % 2 === 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(({ row, status: rowStatus }) => (
          <MobileEventCard
            key={row.id}
            event={row}
            status={rowStatus}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </>
  );
}

function HeaderCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className="font-heading uppercase"
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: ".12em",
        color: "var(--color-text-muted)",
        padding: "12px 14px",
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function TableRow({
  event,
  status,
  isAdmin,
  striped,
}: {
  event: DashboardEventRow;
  status: Exclude<StatusFilter, "all">;
  isAdmin: boolean;
  striped: boolean;
}) {
  const dates = fmtDateRange(event.start_date, event.end_date);
  const location = cityState(event);
  const rating = Number(event.general_rating ?? 0);
  const reviews = event.reviews ?? 0;

  const cellStyle: React.CSSProperties = {
    padding: "14px",
    verticalAlign: "middle",
    fontSize: 13.5,
    color: "var(--color-dark)",
  };

  return (
    <tr
      style={{
        background: striped ? "var(--color-surface)" : "#fff",
        borderTop: "1px solid var(--color-border-light)",
      }}
    >
      <td style={cellStyle}>
        <div className="flex min-w-0 items-center gap-3">
          <EventThumb
            logo={event.logo}
            title={event.title}
            premium={event.premium}
          />
          <div className="min-w-0">
            <Link
              href={`/events/${event.id}`}
              className="font-heading truncate no-underline hover:opacity-80"
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: "var(--color-dark)",
                letterSpacing: "-0.01em",
                display: "block",
                maxWidth: 320,
              }}
            >
              {event.title}
            </Link>
            {isAdmin && event.host_club && (
              <div
                className="mt-0.5 truncate"
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  maxWidth: 320,
                }}
              >
                {event.host_club}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={cellStyle}>
        <span style={{ fontSize: 13, color: "var(--color-dark-light)" }}>
          {dates || "—"}
        </span>
      </td>
      <td style={cellStyle}>
        <span
          className="inline-flex items-center gap-1"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          {location || "—"}
        </span>
      </td>
      <td style={{ ...cellStyle, textAlign: "center" }}>
        <StatusBadge status={status} />
        {event.premium && (
          <span
            className="font-heading ml-1.5 inline-flex items-center uppercase"
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".12em",
              color: "#fff",
              background: "var(--color-accent)",
              padding: "3px 6px 3px",
              borderRadius: 4,
            }}
          >
            Featured
          </span>
        )}
      </td>
      <td style={{ ...cellStyle, textAlign: "right" }}>
        <ReviewsCell rating={rating} count={reviews} />
      </td>
      <td style={{ ...cellStyle, textAlign: "right" }}>
        <ActionsMenu eventId={event.id} />
      </td>
    </tr>
  );
}

function MobileEventCard({
  event,
  status,
  isAdmin,
}: {
  event: DashboardEventRow;
  status: Exclude<StatusFilter, "all">;
  isAdmin: boolean;
}) {
  const dates = fmtDateRange(event.start_date, event.end_date);
  const location = cityState(event);
  const rating = Number(event.general_rating ?? 0);
  const reviews = event.reviews ?? 0;

  return (
    <article
      className="rounded-xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        padding: 12,
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <div className="flex items-start gap-3">
        <EventThumb
          logo={event.logo}
          title={event.title}
          premium={event.premium}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={status} />
            {event.premium && (
              <span
                className="font-heading inline-flex items-center uppercase"
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  color: "#fff",
                  background: "var(--color-accent)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                Featured
              </span>
            )}
          </div>
          <Link
            href={`/events/${event.id}`}
            className="font-heading mt-1.5 block no-underline"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-dark)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {event.title}
          </Link>
          {isAdmin && event.host_club && (
            <div
              className="mt-0.5 truncate"
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              {event.host_club}
            </div>
          )}
          <div
            className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5"
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            {dates && <span>{dates}</span>}
            {location && <span>{location}</span>}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <ReviewsCell rating={rating} count={reviews} compact />
            <ActionsMenu eventId={event.id} compact />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── Cell components ──────────────────────────────────────────────── */

function EventThumb({
  logo,
  title,
  premium,
}: {
  logo: string | null;
  title: string;
  premium: boolean;
}) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
      style={{
        width: 44,
        height: 44,
        background: premium
          ? "linear-gradient(135deg, #fbfaf7 0%, #f4f1ec 100%)"
          : "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #f3f6fa 60%, #e9eef5 100%)",
        border: `1px solid ${premium ? "#efe9e0" : "#eef2f7"}`,
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          style={{ padding: 3 }}
        />
      ) : (
        <span
          className="font-heading"
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--color-text-faint)",
          }}
        >
          {initials || "TG"}
        </span>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Exclude<StatusFilter, "all">;
}) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="font-heading inline-flex items-center gap-1 uppercase"
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".08em",
        padding: "3px 8px 3px 7px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        className="rounded-full"
        style={{ width: 5, height: 5, background: tone.dot }}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

function ReviewsCell({
  rating,
  count,
  compact = false,
}: {
  rating: number;
  count: number;
  compact?: boolean;
}) {
  if (count === 0) {
    return (
      <span
        style={{
          fontSize: compact ? 11.5 : 12.5,
          color: "var(--color-text-faint)",
          fontWeight: 600,
        }}
      >
        No reviews
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <svg
        width={compact ? 12 : 14}
        height={compact ? 12 : 14}
        viewBox="0 0 24 24"
        fill="var(--color-gold)"
        aria-hidden="true"
        style={{ alignSelf: "center" }}
      >
        <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
      </svg>
      <b
        className="font-heading"
        style={{
          fontSize: compact ? 13 : 14,
          fontWeight: 800,
          color: "var(--color-dark)",
          letterSpacing: "-0.01em",
        }}
      >
        {rating.toFixed(2)}
      </b>
      <span
        style={{
          fontSize: compact ? 11 : 11.5,
          color: "var(--color-text-faint)",
          fontWeight: 600,
        }}
      >
        · {count}
      </span>
    </span>
  );
}

function ActionsMenu({
  eventId,
  compact = false,
}: {
  eventId: string;
  compact?: boolean;
}) {
  // MVP: two direct actions. A proper "…" menu with promote / duplicate /
  // delete comes when the underlying flows exist.
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link
        href={`/events/${eventId}`}
        target="_blank"
        rel="noreferrer"
        className="font-heading tg-hover cursor-pointer rounded-md no-underline transition-colors"
        style={{
          fontSize: compact ? 11.5 : 12,
          fontWeight: 700,
          color: "var(--color-text-secondary)",
          padding: "5px 10px",
          border: "1px solid var(--color-border)",
          background: "#fff",
          letterSpacing: "-0.005em",
        }}
      >
        View
      </Link>
      <button
        type="button"
        disabled
        aria-label="Edit event (coming soon)"
        className="font-heading rounded-md transition-colors"
        style={{
          fontSize: compact ? 11.5 : 12,
          fontWeight: 700,
          color: "var(--color-text-faint)",
          padding: "5px 10px",
          border: "1px solid var(--color-border-light)",
          background: "var(--color-surface)",
          cursor: "not-allowed",
          letterSpacing: "-0.005em",
        }}
        title="Editing not yet available"
      >
        Edit
      </button>
    </span>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */

function EmptyState({
  hasFilters,
  isAdmin,
  totalCount,
  onReset,
}: {
  hasFilters: boolean;
  isAdmin: boolean;
  totalCount: number;
  onReset: () => void;
}) {
  const title = hasFilters
    ? "No events match your filters"
    : isAdmin
      ? totalCount === 0
        ? "No events on the platform yet"
        : "Nothing to show"
      : totalCount === 0
        ? "You don't have any events yet"
        : "Nothing to show";
  const detail = hasFilters
    ? "Try clearing the search or the status filter."
    : isAdmin
      ? "Events created by Event Directors will show up here."
      : "Create your first event to start collecting reviews and get in front of teams.";
  return (
    <div
      className="rounded-2xl border border-dashed bg-white p-10 text-center"
      style={{ borderColor: "#cbd5e1" }}
    >
      <div className="mb-1.5" style={{ fontSize: 32 }} aria-hidden="true">
        🏆
      </div>
      <div
        className="font-heading"
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "var(--color-dark)",
        }}
      >
        {title}
      </div>
      <div
        className="mt-1"
        style={{ fontSize: 13, color: "var(--color-text-muted)" }}
      >
        {detail}
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="tg-hover mt-4 cursor-pointer rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: "var(--color-dark)" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ── date + location helpers (local to keep this file self-contained) ── */

function fmtDateRange(start?: string | null, end?: string | null): string {
  if (!start) return "";
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString("en-US", { month: "short" })} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${fmt(s)} – ${fmt(e)}`;
}

function cityState(e: {
  location_text: string | null;
  state: string | null;
}): string | null {
  const stateField = e.state?.trim().toUpperCase() || null;
  const raw = e.location_text?.trim();
  if (!raw) return stateField;

  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !/^(usa|united states)$/i.test(p));

  let city: string | null = null;
  let st: string | null = stateField;
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i].match(/^([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
    if (m) {
      st = m[1].toUpperCase();
      city = parts[i - 1] ?? null;
      break;
    }
  }
  if (!city) {
    city =
      [...parts].reverse().find((p) => /[a-z]/.test(p)) ??
      parts[parts.length - 1] ??
      null;
  }
  if (city && st) return `${city}, ${st}`;
  return city || st;
}
