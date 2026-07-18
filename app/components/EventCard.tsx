import Image from "next/image";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { ClaimEventCta } from "@/app/(site)/events/[id]/ClaimEventCta";
import { FavoriteButton } from "@/app/components/reviews/FavoriteButton";
import type { EventRow } from "@/app/components/types";
import { safeImageSrc } from "@/lib/url";

/**
 * Who is viewing a claimable card, so the Claim CTA can branch without a
 * per-card DB round-trip: anon → ED-signup, signed-in ED → claim modal,
 * signed-in non-ED → no CTA. Computed once on the server page.
 */
export type ClaimViewer = "anon" | "ed" | "other";

/* ── date helpers ────────────────────────────────────────────────────── */

function fmtDateRange(start?: string | null, end?: string | null) {
  if (!start) return "";
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${fmt(s).split(" ")[0]} ${s.getDate()}–${e.getDate()}`;
  }
  return `${fmt(s)} – ${fmt(e)}`;
}

/* Collapse a full street address into a compact "City, ST". Ported from
   FeaturedShowcase so the search cards read the same way as the landing
   tiles. */
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

/* ── shared primitives ──────────────────────────────────────────────── */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 999,
        background: "#f1f5f9",
        color: "#475569",
        fontWeight: 600,
        border: "1px solid #e2e8f0",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* Status pill — one canonical slot for event lifecycle:
     * open       → registration is live (green)
     * concluded  → event is in the past (neutral gray)
   Uses the same footprint as the neutral Pill above so it sits inline
   with the demographic pills that follow. */
function StatusPill({
  kind,
  children,
}: {
  kind: "open" | "concluded";
  children: React.ReactNode;
}) {
  const theme =
    kind === "open"
      ? {
          bg: "#ecfdf5",
          color: "#15803d",
          border: "#bbf7d0",
          dot: "#16a34a",
        }
      : {
          bg: "#f1f5f9",
          color: "#475569",
          border: "#e2e8f0",
          dot: "#94a3b8",
        };
  return (
    <span
      className="font-heading inline-flex items-center gap-1.5 uppercase"
      style={{
        fontSize: 10,
        padding: "3px 9px 3px 8px",
        borderRadius: 999,
        background: theme.bg,
        color: theme.color,
        fontWeight: 800,
        letterSpacing: ".06em",
        border: `1px solid ${theme.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        className="rounded-full"
        style={{ width: 5, height: 5, background: theme.dot }}
      />
      {children}
    </span>
  );
}

/* Calendar date tile — paper-leaf version. Red MONTH caption, big day
   number as the anchor, subtle year and slim top rule. */
function CalendarDate({ start, end }: { start: string; end?: string | null }) {
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const mon = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const sameMonth =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const header = sameMonth ? mon(s) : `${mon(s)}–${mon(e)}`;
  const days =
    s.getDate() === e.getDate()
      ? `${s.getDate()}`
      : `${s.getDate()}–${e.getDate()}`;
  const year = s.getFullYear();

  return (
    <div
      className="inline-flex shrink-0 flex-col items-stretch overflow-hidden text-center"
      style={{
        position: "relative",
        borderRadius: 10,
        background: "#fff",
        minWidth: 58,
        lineHeight: 1,
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 8,
          right: 8,
          height: 2,
          background: "var(--color-accent)",
          borderRadius: 1,
        }}
      />
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: ".16em",
          color: "var(--color-accent)",
          padding: "8px 10px 2px",
        }}
      >
        {header}
      </div>
      <div
        className="font-heading"
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: "var(--color-dark)",
          padding: "2px 10px 3px",
          letterSpacing: "-0.03em",
        }}
      >
        {days}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: ".08em",
          color: "var(--color-text-faint)",
          padding: "0 10px 8px",
        }}
      >
        {year}
      </div>
    </div>
  );
}

function SaveHeart() {
  return (
    <button
      type="button"
      aria-label="Save event"
      className="tg-save-heart inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full"
      style={{
        width: 32,
        height: 32,
        // White inset lifted button — visible against every surface
        // (white card body, tinted logo panel, aurora backdrop) rather
        // than blending in. Faint accent border so the affordance
        // reads as brand-owned.
        border: "1px solid rgba(220,38,38,.18)",
        background: "#fff",
        color: "#94a3b8",
        boxShadow:
          "0 2px 6px rgba(15,23,42,.10), 0 6px 14px -6px rgba(15,23,42,.14)",
        transition:
          "color .15s ease, background .15s ease, transform .1s ease, box-shadow .15s ease, border-color .15s ease",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </button>
  );
}

function OrgAvatar({
  logo,
  name,
  size = 20,
}: {
  logo?: string | null;
  name: string;
  size?: number;
}) {
  const ring = "0 2px 6px rgba(15,23,42,.16), 0 0 0 1px rgba(15,23,42,.06)";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ border: "2px solid #fff", boxShadow: ring }}
    >
      <Avatar
        name={name || "?"}
        size={size}
        src={logo ? safeImageSrc(logo) : null}
      />
    </span>
  );
}

/** U-age index: "u10" -> 10 so U9 sorts before U10. */
function ageIndex(v: string): number {
  const m = /^u(\d+)$/i.exec(v);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/** DB enum → display label for competition level. Bubble stored these as
 *  "high / upper / middle / lower / low"; the enum in Supabase is
 *  "highest / upper / middle / lower / lowest". Support both. */
const LEVEL_LABEL: Record<string, string> = {
  highest: "Highest",
  high: "Highest",
  upper: "Upper",
  middle: "Middle",
  lower: "Lower",
  lowest: "Lowest",
  low: "Lowest",
};

/** Whole-word excerpt for the card body. Returns null for missing or
 *  trivially short descriptions so the card doesn't render a dangling line. */
function shortExcerpt(desc: string | null, max = 120): string | null {
  const t = desc?.trim();
  if (!t || t.length < 40) return null;
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/* ── card ────────────────────────────────────────────────────────────── */

export function EventCard({
  event,
  claimViewer,
  favorited,
  canFavorite,
}: {
  event: EventRow;
  claimViewer?: ClaimViewer;
  /** Whether the current viewer has favorited this event. */
  favorited?: boolean;
  /** When defined, the save heart becomes interactive (search results);
   *  false = signed out → clicking nudges them to sign in. */
  canFavorite?: boolean;
}) {
  const isFeatured = !!event.premium;
  // Unclaimed (admin-created) events carry a Claim CTA per spec §9.7 —
  // only rendered where a viewer context is supplied (the search page).
  const claimable =
    event.owner_id == null &&
    (claimViewer === "anon" || claimViewer === "ed");

  const ages =
    event.event_ages
      ?.map((a) => a.age.toUpperCase())
      .sort((a, b) => ageIndex(a) - ageIndex(b)) ?? [];
  const ageLabel =
    ages.length > 1
      ? `${ages[0]}–${ages[ages.length - 1]}`
      : ages[0] ?? null;

  const genders = event.event_genders?.map((g) => capitalize(g.gender)) ?? [];
  const genderLabel =
    genders.length === 0
      ? null
      : genders.length === 1
        ? genders[0]
        : "Coed";

  const levels = (event.event_competition_levels ?? []).map((l) =>
    LEVEL_LABEL[l.level] ?? capitalize(l.level),
  );
  const surfaces = (event.event_fields ?? []).map((f) =>
    capitalize(f.surface),
  );

  const teams = event.nr_teams_last_year;
  const location = cityState(event);
  const concluded =
    event.status === "concluded" ||
    (!!event.end_date && new Date(event.end_date) < new Date());
  const isOpen = !concluded && event.status === "open";

  const excerpt = shortExcerpt(event.description);

  const hostName = event.host_club || null;
  const showHostRow = !!(hostName || event.host_logo);
  const hostHref = event.owner_id ? `/directors/${event.owner_id}` : null;

  return (
    <article
      className={`tg-event-card group relative overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        concluded && !isFeatured ? "tg-card-concluded" : ""
      }`}
      style={{
        containerType: "inline-size",
        borderColor: isFeatured ? "rgba(220,38,38,.32)" : "var(--color-border)",
        boxShadow: isFeatured
          ? "0 14px 32px -18px rgba(220,38,38,.55), 0 2px 6px rgba(220,38,38,.10), 0 1px 2px rgba(15,23,42,.06)"
          : "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      {/* Top-right action cluster — status pill + save button stacked
          together so both card-level actions/labels share one anchored
          corner. The heart floats alone otherwise (its previous inline
          position by the title made it barely findable against the
          bold title text). Pairing them here makes them read as one
          unit: "here's what this event is doing (status) and here's
          what you can do with it (save)". */}
      <div
        className="absolute z-10 flex flex-col items-end gap-1.5"
        style={{ top: 10, right: 12 }}
      >
        {concluded ? (
          <StatusPill kind="concluded">Concluded</StatusPill>
        ) : isOpen ? (
          <StatusPill kind="open">Open</StatusPill>
        ) : null}
        {canFavorite === undefined ? (
          <SaveHeart />
        ) : (
          <FavoriteButton
            variant="icon"
            eventId={event.id}
            initialFavorited={favorited ?? false}
            disabled={!canFavorite}
          />
        )}
      </div>
      <div className="tg-card-body flex items-stretch" style={{ padding: 8, gap: 4 }}>
        {/* ── LEFT COLUMN — logo panel + host row. */}
        <div className="tg-card-left flex shrink-0 flex-col" style={{ width: 168, gap: 8 }}>
        <div
          className="relative overflow-hidden rounded-xl"
          style={{
            minHeight: 168,
            flex: "1 1 168px",
            background: isFeatured
              ? "linear-gradient(135deg, #fbfaf7 0%, #f4f1ec 100%)"
              : "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #f3f6fa 60%, #e9eef5 100%)",
            border: `1px solid ${isFeatured ? "#efe9e0" : "#eef2f7"}`,
          }}
        >
            {/* Removed: red vertical accent stripe on the logo panel's
                left edge. The outer card border + soft red glow already
                signal "featured"; the stripe read as a random graphic
                element after the per-card "Featured" text label was
                dropped. */}
            <span
              aria-hidden="true"
              className="tg-ball pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span
                style={{
                  fontSize: 96,
                  lineHeight: 1,
                  opacity: event.logo ? 0.05 : 0.12,
                }}
              >
                ⚽
              </span>
            </span>

            {event.logo ? (
              <Image
                src={event.logo}
                alt={`${event.title} logo`}
                fill
                sizes="168px"
                className="object-contain p-3"
              />
            ) : (
              <div className="relative flex h-full items-center justify-center">
                <span
                  className="font-heading text-2xl font-extrabold"
                  style={{
                    color: "var(--color-text-faint)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  TG
                </span>
              </div>
            )}

            {concluded && (
              // Concluded: a subtle white wash only. The lifecycle chip
              // ("Concluded") now lives in the pills row alongside "Open"
              // so all status labels share one canonical location, and
              // nothing else on the logo panel competes with the Featured
              // tier badge.
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: "rgba(255,255,255,.35)" }}
              />
            )}
          {/* Per-card "Featured" text label removed (Franco, June 18 —
              "the featured label can get lost with all this stuff going
              on"). Featured events are now differentiated by:
                • the red-tinted card border + soft red glow shadow
                • the dual Coach + Attendee rating breakdown below
              Non-featured cards get a neutral border + Attendee-only
              rating, which is the ranking cue Franco locked in. */}
          </div>

          {/* Host row — under the logo panel. Clickable when we know the
              owner id; falls back to a non-interactive display otherwise. */}
          {showHostRow && (
            hostHref ? (
              <Link
                href={hostHref}
                className="tg-host-link group/host flex items-center gap-2 rounded-lg px-2 py-1.5 no-underline outline-none transition-all"
                style={{
                  color: "inherit",
                  // Baseline background + subtle border on non-hover so
                  // the row visually reads as an interactive chip, not
                  // as plain adjacent metadata. Franco (Dec 2026): the
                  // host row needed a clear "this is clickable" cue.
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-light)",
                }}
              >
                <HostBody
                  hostName={hostName}
                  hostLogo={event.host_logo}
                  location={location}
                />
                {/* Chevron indicating navigation — subtle by default,
                    slides right + brightens on hover so the affordance
                    is discoverable without being loud on rest. */}
                <span
                  aria-hidden="true"
                  className="tg-host-chev ml-auto shrink-0"
                  style={{
                    color: "var(--color-text-faint)",
                    transition: "transform .18s ease, color .18s ease",
                    lineHeight: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <HostBody
                  hostName={hostName}
                  hostLogo={event.host_logo}
                  location={location}
                />
              </div>
            )
          )}
        </div>

        {/* ── RIGHT COLUMN — title, pills, excerpt, ratings + save/calendar
             rail. No host row here anymore — it lives in the left column
             under the logo. */}
        <div
          className="flex min-w-0 flex-1 items-stretch gap-3.5"
          style={{ padding: "6px 12px" }}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Title — reserves right padding to clear the absolute
                top-right action cluster (status pill + heart, both
                stacked in the corner). No more inline heart competing
                with the title text for the same slot. */}
            <Link
              href={`/events/${event.id}`}
              className="font-heading line-clamp-2 no-underline transition-colors hover:opacity-90"
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: "var(--color-dark)",
                letterSpacing: "-0.025em",
                lineHeight: 1.15,
                overflowWrap: "anywhere",
                paddingRight: 92,
              }}
            >
              {event.title}
            </Link>

            {/* Demographic pills row — status pill lives in the top-right
                corner (absolute) now, so this row is dedicated to the
                filter values that actually help sorting: teams, ages,
                gender, level, surface. Reads cleaner without the
                lifecycle chip stealing lead slot. Empty check so the
                row collapses when the event has no tags at all. */}
            {(teams != null && teams > 0) ||
            ageLabel ||
            genderLabel ||
            levels.length > 0 ||
            surfaces.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {teams != null && teams > 0 && <Pill>{teams} teams</Pill>}
                {ageLabel && <Pill>{ageLabel}</Pill>}
                {genderLabel && <Pill>{genderLabel}</Pill>}
                {levels.map((l) => (
                  <Pill key={`lvl-${l}`}>{l}</Pill>
                ))}
                {surfaces.map((s) => (
                  <Pill key={`srf-${s}`}>{s}</Pill>
                ))}
              </div>
            ) : null}

            {event.would_return_pct != null && event.would_return_pct > 0 && (
              <div className="mt-2.5">
                <WouldReturnCue pct={event.would_return_pct} />
              </div>
            )}

            {excerpt && (
              <p
                className="mt-3.5 mb-0"
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.5,
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

            <div
              className={
                "mt-auto pt-3 " +
                (isFeatured
                  ? "flex flex-col items-stretch gap-1.5"
                  : "flex flex-wrap items-center gap-2")
              }
            >
              {isFeatured ? (
                <>
                  {/* Featured cards stack Coach *above* Attendee — Coach
                      is the premium differentiator (per Franco: expert
                      review is what makes featured worth paying for), so
                      it leads. Non-featured cards only ever show Attendee
                      and stay in the horizontal wrap. */}
                  <AudienceRating
                    kind="coach"
                    score={numOr0(event.coach_rating)}
                    count={event.coach_reviews ?? 0}
                  />
                  <AudienceRating
                    kind="attendee"
                    score={numOr0(
                      event.attendee_rating ?? event.general_rating,
                    )}
                    count={event.attendee_reviews ?? event.reviews ?? 0}
                  />
                </>
              ) : (
                <AudienceRating
                  kind="attendee"
                  score={numOr0(
                    event.attendee_rating ?? event.general_rating,
                  )}
                  count={event.attendee_reviews ?? event.reviews ?? 0}
                />
              )}
            </div>
            {claimable && (
              <div className="mt-3">
                <ClaimEventCta
                  eventId={event.id}
                  state={claimViewer === "anon" ? "anon" : "requestable"}
                />
              </div>
            )}
          </div>

          {/* Right rail — calendar tile only, anchored to the bottom.
              Heart moved up into the title row so this column is a
              single-purpose date anchor rather than a two-widget rail
              with dead vertical space in between. */}
          <div className="flex shrink-0 flex-col items-end justify-end">
            {event.start_date && (
              <CalendarDate start={event.start_date} end={event.end_date} />
            )}
          </div>
        </div>
      </div>
      <style>{`
        .tg-host-link:hover, .tg-host-link:focus-visible {
          background: var(--color-surface-alt) !important;
          border-color: var(--color-border) !important;
        }
        .tg-host-link:hover .tg-host-chev,
        .tg-host-link:focus-visible .tg-host-chev {
          color: var(--color-accent);
          transform: translateX(2px);
        }
        /* Save heart hover — fills with brand red so the "save" verb
           reads clearly, and lifts slightly so users get feedback
           that the target hit. Inline styles on the base button beat
           class-level pseudo-classes for specificity, so hover styles
           use !important here (same trap as the search box). */
        .tg-save-heart:hover, .tg-save-heart:focus-visible {
          color: var(--color-accent) !important;
          border-color: var(--color-accent) !important;
          background: color-mix(in srgb, var(--color-accent) 8%, #fff) !important;
          transform: translateY(-1px);
          box-shadow:
            0 4px 10px rgba(220,38,38,.20),
            0 8px 20px -6px rgba(220,38,38,.25) !important;
        }
        .tg-save-heart:active { transform: translateY(0); }
        /* Concluded cards sit alongside open ones in the results list.
           Dim the whole card so it visibly deprioritizes without
           hiding info — hovering / focusing restores full opacity so
           the user can still read it clearly on interaction. */
        .tg-card-concluded { opacity: .68; }
        .tg-card-concluded:hover,
        .tg-card-concluded:focus-within { opacity: 1; }
        /* Compact stacked layout when the card's container is narrow */
        @container (max-width: 420px) {
          .tg-card-body {
            flex-direction: column !important;
          }
          .tg-card-left {
            width: 100% !important;
            flex-shrink: 1;
          }
        }
      `}</style>
    </article>
  );
}

/* "% would return" — the verified-attendee retention cue (spec §5.2).
   Drawn from would_return_pct (coach + team-manager reviews that answered
   the would-return question). Rendered as a prominent amber pill. */
function WouldReturnCue({ pct }: { pct: number }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 self-start rounded-full"
      style={{
        marginTop: 2,
        padding: "4px 10px",
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        fontSize: 11.5,
        fontWeight: 800,
        letterSpacing: "-0.005em",
        color: "#9a3412",
      }}
      title={`${Math.round(pct)}% of verified reviewers would return`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 019-9 9 9 0 016.7 3" />
        <path d="M21 3v6h-6" />
        <path d="M21 12a9 9 0 01-9 9 9 9 0 01-6.7-3" />
        <path d="M3 21v-6h6" />
      </svg>
      {Math.round(pct)}% would return
    </div>
  );
}

/* HostBody — the visible contents of the host row (avatar + name + location).
   Extracted so we can wrap it in either a <Link> (when we know the owner)
   or a plain <div> (when we don't). */
function HostBody({
  hostName,
  hostLogo,
  location,
}: {
  hostName: string | null;
  hostLogo: string | null | undefined;
  location: string | null;
}) {
  return (
    <>
      <OrgAvatar
        logo={hostLogo}
        name={hostName || "?"}
        size={30}
      />
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        {hostName && (
          <span
            className="min-w-0"
            title={hostName}
            style={{
              // Allow up to 2 lines so long host names (e.g.
              // "St. Louis Scott Gallagher") stay legible instead of
              // truncating mid-word. Web-kit line clamp so the second
              // line still ends with an ellipsis on genuinely long
              // names.
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--color-dark-light)",
              letterSpacing: "-0.005em",
              lineHeight: 1.25,
            }}
          >
            {hostName}
          </span>
        )}
        {location && (
          <span
            className="inline-flex min-w-0 items-center gap-1"
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: "var(--color-text-muted)",
            }}
          >
            <IconPin />
            <span className="min-w-0 truncate">{location}</span>
          </span>
        )}
      </div>
    </>
  );
}

/* ── rating chip ──────────────────────────────────────────────────────
   Editorial per-audience rating. White chip with a thin border and a
   small colored accent tile holding the icon. Score is the anchor;
   label small-caps caption; count muted tail. */

function AudienceRating({
  kind,
  score,
  count,
}: {
  kind: "coach" | "attendee";
  score: number;
  count: number;
}) {
  const isCoach = kind === "coach";
  const has = score > 0;

  const theme = isCoach
    ? { label: "Coach", accent: "var(--color-accent)", tileBg: "#fef2f2" }
    : { label: "Attendee", accent: "var(--color-gold)", tileBg: "#fffbeb" };

  return (
    <span
      className="inline-flex items-center gap-2.5 rounded-xl"
      style={{
        background: "#fff",
        border: "1px solid var(--color-border)",
        padding: "6px 14px 6px 6px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <span
        className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg"
        style={{ background: theme.tileBg }}
      >
        <KindGlyph kind={kind} color={theme.accent} />
      </span>

      <span
        className="font-heading uppercase"
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".1em",
          color: "var(--color-text-muted)",
        }}
      >
        {theme.label}
      </span>

      {/* Score + review count, or "No reviews yet" when empty. */}
      {has ? (
        <span className="inline-flex items-baseline whitespace-nowrap">
          <b
            className="font-heading"
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "-0.015em",
              color: "var(--color-dark)",
              lineHeight: 1,
            }}
          >
            {fmtScore(score)}
          </b>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--color-text-faint)",
              marginLeft: 2,
            }}
          >
            /5
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-muted)",
              marginLeft: 6,
            }}
          >
            · {count} review{count === 1 ? "" : "s"}
          </span>
        </span>
      ) : (
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-text-muted)",
          }}
        >
          No reviews yet
        </span>
      )}
    </span>
  );
}

function KindGlyph({
  kind,
  color,
}: {
  kind: "coach" | "attendee";
  color: string;
}) {
  return kind === "coach" ? (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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

function numOr0(v: number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtScore(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function IconPin() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-text-muted)"
      strokeWidth="2"
      aria-hidden="true"
      className="shrink-0"
      style={{ display: "inline", verticalAlign: "-1px" }}
    >
      <path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { fmtDateRange };
