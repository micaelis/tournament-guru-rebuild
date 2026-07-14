import Link from "next/link";
import { Avatar } from "./Avatar";
import { LogoPanel, fmtDateRange } from "./card-bits";
import type { EventRow } from "@/lib/supabase/queries";
import { safeImageSrc } from "@/lib/url";

/* ── derived helpers ─────────────────────────────────────── */

function toNum(v: number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* TEMP / PREVIEW ONLY ─────────────────────────────────────────
   Real data currently has zero coach reviews, so the ratings row only ever
   shows the single Attendee block. Flip this on to synthesize a plausible
   Coach Rating (derived deterministically from the attendee score) purely so
   the two-column layout can be reviewed. Set to false — or delete this block
   and `simulatedCoach` — to return to real data only. */
const SIMULATE_COACH_RATINGS = true;

function simulatedCoach(
  attendee: number,
  attendeeReviews: number | null
): { score: number; reviews: number } {
  return {
    score: Math.max(3.6, Math.round((attendee - 0.28) * 100) / 100),
    reviews: Math.max(2, Math.round((attendeeReviews ?? 0) * 0.42)),
  };
}

/* Short, whole-word excerpt for the card body. Returns null for missing or
   trivially short descriptions so the card doesn't render a dangling line. */
function shortExcerpt(desc: string | null, max = 104): string | null {
  const t = desc?.trim();
  if (!t || t.length < 40) return null;
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/* Collapse a full street address into a compact "City, ST". Featured cards
   only have room for the essentials — the full address lives on the event page.
   Falls back to the event's own `state` column, then to whatever text we have. */
function cityState(e: EventRow): string | null {
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

/* ── section ─────────────────────────────────────────────────
   Every featured event pays the same for placement, so no card gets a
   dominant hero treatment — they share one uniform card in a 4-up grid that
   collapses to 2×2 on tablet and a single column on mobile. */

export function FeaturedShowcase({ events }: { events: EventRow[] }) {
  const cards = events.slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((e) => (
        <FeaturedCard key={e.id} event={e} />
      ))}
    </div>
  );
}

/* ── shared featured card ────────────────────────────────── */

function FeaturedCard({ event }: { event: EventRow }) {
  const excerpt = shortExcerpt(event.description);
  const place = cityState(event);
  const dates = event.start_date
    ? fmtDateRange(event.start_date, event.end_date)
    : null;
  const bracket = ageGenderBracket(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        border: "1px solid rgba(220,38,38,.22)",
        boxShadow:
          "0 12px 30px -20px rgba(220,38,38,.30), 0 1px 3px rgba(15,23,42,.05)",
      }}
    >
      {/* Logo panel — the whole section is featured, so no per-card badge;
          only the live status chip overlays the branded ball texture. */}
      <div className="relative">
        <LogoPanel
          logo={event.logo}
          title={event.title}
          texture
          style={{ height: 150 }}
        />
        <span className="absolute right-3 top-3">
          <StatusChip status={event.status} />
        </span>
      </div>

      {/* Content */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ padding: "15px 16px 17px" }}
      >
        <h3
          className="font-heading text-dark"
          style={{
            fontSize: 16.5,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.22,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {event.title}
        </h3>

        {event.host_club && (
          <div
            className="mt-2.5 flex items-center gap-2"
            style={{ color: "var(--color-dark-light)" }}
          >
            <OrgLogo logo={event.host_logo} name={event.host_club} size={28} />
            <span
              className="truncate font-semibold"
              style={{ fontSize: 14, letterSpacing: "-0.01em" }}
            >
              {event.host_club}
            </span>
          </div>
        )}

        {/* Address + dates + age/gender bracket, unified on one line */}
        <MetaLine place={place} dates={dates} bracket={bracket} />

        {excerpt && (
          <p
            className="mt-2.5 mb-0"
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--color-text-secondary)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {excerpt}
          </p>
        )}

        {/* Footer — rating breakdown. The whole card is the link, so no
            separate CTA is needed. */}
        <div className="mt-auto pt-4">
          {(() => {
            const attendee = toNum(event.attendee_rating);
            let coach = toNum(event.coach_rating);
            let coachReviews = event.coach_reviews ?? null;
            if (SIMULATE_COACH_RATINGS && coach <= 0 && attendee > 0) {
              const sim = simulatedCoach(attendee, event.attendee_reviews ?? null);
              coach = sim.score;
              coachReviews = sim.reviews;
            }
            return (
              <RatingBreakdown
                attendee={attendee}
                coach={coach}
                attendeeReviews={event.attendee_reviews ?? null}
                coachReviews={coachReviews}
              />
            );
          })()}
        </div>
      </div>
    </Link>
  );
}

/* ── meta line: address · dates ──────────────────────────── */

function MetaLine({
  place,
  dates,
  bracket,
}: {
  place: string | null;
  dates: string | null;
  bracket: string | null;
}) {
  if (!place && !dates && !bracket) return null;
  const chipStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    background: "var(--color-surface-alt)",
    border: "1px solid var(--color-border)",
    padding: "3px 9px",
  };
  // wrap on narrow widths — three pills won't always fit one line
  return (
    <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5">
      {place && (
        <span
          className="inline-flex min-w-0 items-center gap-1 rounded-md"
          style={chipStyle}
        >
          <LocationPin />
          <span className="min-w-0 truncate" title={place}>
            {place}
          </span>
        </span>
      )}
      {dates && (
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md"
          style={chipStyle}
        >
          <CalIcon />
          {dates}
        </span>
      )}
      {bracket && (
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md"
          style={chipStyle}
          title={bracket}
        >
          <BracketIcon />
          {bracket}
        </span>
      )}
    </div>
  );
}

/* Compact age × gender label for the third meta chip.
   Age = the min–max U-range across event_ages (e.g. "U8–U12"), or a
   single "U10" when only one age is set. Gender = "Boys" / "Girls" /
   "Co-ed" when multiple. Renders as null when neither is available. */
function ageGenderBracket(event: EventRow): string | null {
  const ages = (event.event_ages ?? [])
    .map((a) => a.age.toUpperCase())
    .sort((a, b) => ageNum(a) - ageNum(b));
  const ageLabel =
    ages.length === 0
      ? null
      : ages.length === 1
        ? ages[0]
        : `${ages[0]}–${ages[ages.length - 1]}`;

  const genders = (event.event_genders ?? []).map((g) =>
    g.gender.toLowerCase(),
  );
  const genderLabel =
    genders.length === 0
      ? null
      : genders.length > 1
        ? "Co-ed"
        : genders[0] === "boys"
          ? "Boys"
          : genders[0] === "girls"
            ? "Girls"
            : "Co-ed";

  if (ageLabel && genderLabel) return `${ageLabel} · ${genderLabel}`;
  return ageLabel ?? genderLabel;
}

function ageNum(v: string): number {
  const m = /^U(\d+)$/i.exec(v);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function BracketIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2 20c0-3.4 3.2-5.2 7-5.2s7 1.8 7 5.2" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M22 19c0-2.7-2.4-4-5-4" />
    </svg>
  );
}

/* ── rating breakdown: coach + attendee ──────────────────────
   Side-by-side stat tiles — one per audience — with a coloured top rule
   (red for Coach, gold for Attendee), the big score as the anchor, an
   inline 5-star row, and a small review-count strap underneath. Reads
   like a mini leaderboard on the featured card. Redesign of the earlier
   two-pill-stack per Franco's ask (2026-07).

   Behavior: when both audiences have reviews we render both tiles. When
   only one has reviews, that tile expands to full width; when neither
   does, a single "Awaiting reviews" placeholder is shown so the card's
   footer never collapses. */

/* Round to ≤2 decimals and drop trailing zeros: 4 → "4", 4.3 → "4.3", 4.33. */
function fmtAvg(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/* Per-kind accent theme. Each row is its own very-pale-tinted block; inside
   sits an accent-coloured chip with white text (reversed colours). Coach =
   brand red, Attendee = brand gold/yellow. */
const RATING_THEME = {
  coach: {
    label: "Coach",
    accent: "var(--color-accent)", // #dc2626 — top rule, icon, mini-stars
    tileBg:
      "linear-gradient(180deg, rgba(220,38,38,.05) 0%, rgba(255,255,255,0) 60%)",
    tileBorder: "rgba(220,38,38,.18)",
  },
  attendee: {
    label: "Attendee",
    accent: "var(--color-gold)", // #f59e0b
    tileBg:
      "linear-gradient(180deg, rgba(245,158,11,.08) 0%, rgba(255,255,255,0) 60%)",
    tileBorder: "rgba(245,158,11,.28)",
  },
} as const;

/* Small identifying glyph — a stylised profile silhouette for attendees and a
   whistle outline for coaches. Both sit in the accent colour. */
function KindGlyph({ kind, color }: { kind: "coach" | "attendee"; color: string }) {
  return kind === "coach" ? (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M8.5 9a5.5 5.5 0 105.5 5.5V9H8.5z" />
      <path d="M14 11l7-2.5V6l-7 2.6" />
    </svg>
  ) : (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="8" r="3.3" />
      <path d="M4 20c0-3.6 3.6-5.6 8-5.6s8 2 8 5.6" />
    </svg>
  );
}

function RatingTile({
  kind,
  score,
  reviews,
}: {
  kind: "attendee" | "coach";
  score: number;
  reviews?: number | null;
}) {
  const t = RATING_THEME[kind];
  const count = reviews ?? 0;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 12,
        border: `1px solid ${t.tileBorder}`,
        background: t.tileBg,
        padding: "10px 12px 9px",
      }}
    >
      {/* Top accent rule — the tile's colour identity, hugging the top edge */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 12,
          right: 12,
          height: 2,
          background: t.accent,
          borderRadius: 1,
        }}
      />
      <div className="flex items-center gap-1.5">
        <KindGlyph kind={kind} color={t.accent} />
        <span
          className="font-heading uppercase"
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: ".14em",
            color: "var(--color-text-muted)",
          }}
        >
          {t.label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <b
          className="font-heading"
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--color-dark)",
            lineHeight: 1,
          }}
        >
          {fmtAvg(score)}
        </b>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-text-faint)",
          }}
        >
          /5
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <MiniStars value={score} />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            letterSpacing: ".01em",
          }}
        >
          {count} review{count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

/* Tiny inline 5-star row — a light gray track with the current score
   filled in gold. 4.02 → 4 full + partial 5th. Used inside compact
   surfaces (card rating tiles) where the standard <Stars/> feels heavy. */
function MiniStars({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;
  return (
    <span
      aria-hidden
      className="relative inline-flex"
      style={{ width: 60, height: 11 }}
    >
      {/* Empty track — light gray stars */}
      <StarStrip color="#e2e8f0" />
      {/* Filled overlay — gold stars clipped to pct width */}
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pct}%` }}
      >
        <StarStrip color="var(--color-gold)" />
      </span>
    </span>
  );
}

function StarStrip({ color }: { color: string }) {
  const STAR = "M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z";
  return (
    <span className="flex" style={{ gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill={color}
          aria-hidden="true"
        >
          <path d={STAR} />
        </svg>
      ))}
    </span>
  );
}

function EmptyRatingTile() {
  return (
    <div
      className="rounded-xl"
      style={{
        border: "1px dashed var(--color-border)",
        background: "var(--color-surface)",
        padding: "12px 14px",
      }}
    >
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".14em",
          color: "var(--color-text-muted)",
        }}
      >
        Awaiting reviews
      </div>
      <div
        className="mt-1"
        style={{ fontSize: 12, color: "var(--color-text-faint)" }}
      >
        First coach or attendee review lands here.
      </div>
    </div>
  );
}

function RatingBreakdown({
  attendee,
  coach,
  attendeeReviews,
  coachReviews,
}: {
  attendee: number;
  coach: number;
  attendeeReviews?: number | null;
  coachReviews?: number | null;
}) {
  const hasCoach = coach > 0;
  const hasAttendee = attendee > 0;

  if (!hasCoach && !hasAttendee) return <EmptyRatingTile />;

  if (hasCoach && !hasAttendee) {
    return <RatingTile kind="coach" score={coach} reviews={coachReviews} />;
  }
  if (hasAttendee && !hasCoach) {
    return (
      <RatingTile kind="attendee" score={attendee} reviews={attendeeReviews} />
    );
  }

  // Both present — side-by-side two-tile leaderboard
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <RatingTile kind="coach" score={coach} reviews={coachReviews} />
      <RatingTile kind="attendee" score={attendee} reviews={attendeeReviews} />
    </div>
  );
}

/* ── organizer logo ──────────────────────────────────────────
   Shows the owning organisation's logo (resolved via the event_host_logos
   view) on a lifted white "coin", falling back to tinted initials. */

function OrgLogo({
  logo,
  name,
  size = 28,
}: {
  logo?: string | null;
  name: string;
  size?: number;
}) {
  const ring = "0 2px 7px rgba(15,23,42,.16), 0 0 0 1px rgba(15,23,42,.06)";
  if (logo) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          background: "#fff",
          border: "2px solid #fff",
          boxShadow: ring,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safeImageSrc(logo) ?? undefined}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          style={{ padding: 2 }}
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ border: "2px solid #fff", boxShadow: ring }}
    >
      <Avatar name={name || "?"} size={size} />
    </span>
  );
}

/* ── location pin ────────────────────────────────────────── */

function LocationPin() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#64748b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function CalIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#64748b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

/* ── status chip ─────────────────────────────────────────────
   Open registrations read green; anything else (concluded / canceled / draft)
   reads as a neutral "Closed" so the chip is always present and legible. */

function StatusChip({ status }: { status: string | null }) {
  const open = status?.toLowerCase() === "open";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: open ? "#15803d" : "#64748b",
        background: open ? "#ecfdf5" : "#f8fafc",
        border: `1px solid ${open ? "#bbf7d0" : "#e2e8f0"}`,
        padding: "3px 9px 3px 7px",
        fontFamily: "var(--font-mono)",
        boxShadow: "0 1px 2px rgba(15,23,42,.06)",
      }}
    >
      <span
        className="rounded-full"
        style={{ width: 5, height: 5, background: open ? "#16a34a" : "#94a3b8" }}
      />
      {open ? "Open" : "Closed"}
    </span>
  );
}
