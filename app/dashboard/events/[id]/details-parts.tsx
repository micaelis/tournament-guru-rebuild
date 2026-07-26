import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Card, SafeImg, StarRating, cn } from "@/app/components/ui";
import { Icon, type IconName } from "@/app/dashboard/icons";
import { formatPrice } from "@/lib/format-price";
import { CopyIdButton, InviteReviewsButton } from "./details-actions";

/* ── shared text treatments ────────────────────────────────────────── */

const EYEBROW_CLASS =
  "font-[var(--font-heading)] text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500";
const BAND_EYEBROW_CLASS =
  "font-[var(--font-heading)] text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white/50";
const BAND_VAL_CLASS =
  "font-[var(--font-heading)] font-extrabold leading-none tracking-[-0.02em]";
const BAND_SUB_CLASS = "mt-1 text-[11.5px] font-semibold text-white/55";

/** The accent text-link register — "View public page", sponsor Visit. */
export const ACCENT_LINK_CLASS =
  "inline-flex items-center gap-1.5 text-[13.5px] font-bold text-red-600 underline decoration-red-200 underline-offset-4 transition-colors hover:text-red-700 hover:decoration-red-400";

/* ── small building blocks ─────────────────────────────────────────── */

/**
 * A link dressed as the secondary Button (per-section Edit links, maps
 * link, show-all-reviews) — an anchor because nesting a <button> inside
 * <Link> would stack interactive elements.
 */
export function ButtonLink({
  href,
  external = false,
  className,
  children,
}: {
  href: string;
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-slate-400 bg-transparent px-3 py-1.5 text-[12.5px] font-bold text-slate-900 transition-all duration-150 ease-out hover:border-slate-900 hover:bg-slate-900/[0.045]",
    className,
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer nofollow" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href as Route} className={cls}>
      {children}
    </Link>
  );
}

/**
 * Section shell: color-coded icon chip beside a Bricolage title, an
 * optional sub-line, and the action slot (usually an Edit ButtonLink).
 */
export function SectionCard({
  icon,
  iconClass,
  title,
  sub,
  action,
  children,
}: {
  icon: IconName;
  iconClass: string;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-8 w-8 flex-none place-items-center rounded-[10px]",
              iconClass,
            )}
          >
            <Icon name={icon} className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-[var(--font-heading)] text-[20px] font-extrabold tracking-tight text-slate-900">
              {title}
            </h2>
            {sub && (
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
                {sub}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Eyebrow + value cell for the About facts grid. */
export function FactCell({
  label,
  span2 = false,
  children,
}: {
  label: string;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <p className={EYEBROW_CLASS}>{label}</p>
      <div className="mt-1.5 text-[13.5px] font-semibold text-slate-800">
        {children}
      </div>
    </div>
  );
}

/** Neutral rounded tag (competition levels, surfaces, features). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-[11px] py-1 text-[12px] font-semibold text-slate-700">
      {children}
    </span>
  );
}

/** CSS-only infotip: hover or keyboard focus reveals the ink tooltip. */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="grid h-5 w-5 cursor-help place-items-center rounded-full border-[1.5px] border-slate-300 text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
      >
        <Icon name="info" className="h-[13px] w-[13px]" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+9px)] left-1/2 z-40 w-[238px] -translate-x-1/2 translate-y-[3px] rounded-[10px] bg-slate-900 px-3 py-2 text-left text-[11.5px] font-medium leading-[1.55] text-slate-200 opacity-0 shadow-xl transition-all duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

/* ── hero pieces ───────────────────────────────────────────────────── */

/**
 * The listing's identity mark (events.logo_url). Missing/broken URLs
 * fall back to a red crest tile with the event's initials — the square
 * cousin of Avatar's red-bg placeholder rule.
 */
export function EventLogo({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  const fallback = (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-red-500 to-red-800 font-[var(--font-heading)] text-2xl font-extrabold tracking-wide text-white">
      {initialsOf(title)}
    </div>
  );
  return (
    <div className="relative hidden h-[92px] w-[92px] shrink-0 overflow-hidden rounded-2xl shadow-[0_10px_24px_-10px_rgba(15,23,42,.3)] ring-1 ring-slate-200 sm:block">
      <SafeImg
        src={src ?? undefined}
        alt=""
        className="h-full w-full object-cover"
        fallback={fallback}
      />
    </div>
  );
}

/** One icon-led entry in the hero's meta row. */
export function MetaItem({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} className="h-4 w-4 shrink-0 text-slate-400" />
      {children}
    </span>
  );
}

/* ── summary band (the chosen dark treatment) ──────────────────────── */

function BandRating({
  eyebrow,
  eyebrowClass,
  value,
  sub,
}: {
  eyebrow: string;
  eyebrowClass?: string;
  value: number | null;
  sub: string;
}) {
  return (
    <div>
      <p className={cn(BAND_EYEBROW_CLASS, eyebrowClass)}>{eyebrow}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className={cn(BAND_VAL_CLASS, "text-[24px]")}>
          {value != null ? value.toFixed(2) : "—"}
        </span>
        {value != null && (
          <StarRating
            value={value}
            size={15}
            showNumber={false}
            filledColor="#f59e0b"
            emptyColor="#57606f"
          />
        )}
      </div>
      <p className={BAND_SUB_CLASS}>{sub}</p>
    </div>
  );
}

/**
 * The integrated ink strip under the hero: overall / coach / attendee /
 * would-return as four even metric peers, capped by the price + teams
 * listing facts. With zero reviews the reputation zone collapses into
 * one invite block (the copy-link CTA) and the facts cap stays.
 */
export function SummaryBand({
  eventId,
  reviewCount,
  generalRating,
  coachRating,
  attendeeRating,
  wouldReturnPct,
  priceRange,
  divisionCount,
  teams,
}: {
  eventId: string;
  reviewCount: number;
  generalRating: number | null;
  coachRating: number | null;
  attendeeRating: number | null;
  wouldReturnPct: number | null;
  priceRange: string | null;
  divisionCount: number;
  teams: number | null;
}) {
  return (
    <section
      aria-label="Event summary"
      className="relative overflow-hidden rounded-[18px] text-white shadow-[0_20px_44px_-20px_rgba(15,23,42,.55)]"
      style={{
        background:
          "linear-gradient(115deg,#0b1120 0%,#1e293b 74%,#28364b 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(560px 210px at 12% -30%,rgba(220,38,38,.30),transparent 65%), radial-gradient(430px 200px at 90% 135%,rgba(245,158,11,.16),transparent 70%)",
        }}
      />
      <div className="relative flex flex-col divide-y divide-white/10 lg:flex-row lg:divide-x lg:divide-y-0">
        {reviewCount > 0 ? (
          <div className="flex flex-1 flex-wrap items-center gap-x-9 gap-y-4 px-6 py-5">
            <BandRating
              eyebrow="Overall rating"
              eyebrowClass="text-amber-400"
              value={generalRating}
              sub={`${reviewCount} verified review${reviewCount === 1 ? "" : "s"}`}
            />
            <BandRating
              eyebrow="Coach rating"
              eyebrowClass="text-red-300"
              value={coachRating}
              sub={
                coachRating != null
                  ? "from verified coaches"
                  : "no coach reviews yet"
              }
            />
            <BandRating
              eyebrow="Attendee rating"
              eyebrowClass="text-amber-300"
              value={attendeeRating}
              sub={
                attendeeRating != null
                  ? "from verified attendees"
                  : "no attendee reviews yet"
              }
            />
            <div>
              <p className={BAND_EYEBROW_CLASS}>Would return</p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className={cn(BAND_VAL_CLASS, "text-[24px]")}>
                  {wouldReturnPct != null
                    ? `${Math.round(wouldReturnPct)}%`
                    : "—"}
                </span>
                {wouldReturnPct != null && (
                  <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-white/15">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                      style={{
                        width: `${Math.max(0, Math.min(100, wouldReturnPct))}%`,
                      }}
                    />
                  </span>
                )}
              </div>
              <p className={BAND_SUB_CLASS}>of verified reviewers</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-amber-400/15 text-amber-300">
                <Icon name="star" className="h-5 w-5" />
              </span>
              <div>
                <p className="font-[var(--font-heading)] text-[17px] font-extrabold tracking-tight text-white">
                  No reviews yet
                </p>
                <p className="mt-1 max-w-[52ch] text-[12.5px] font-medium leading-relaxed text-white/55">
                  Your overall rating, coach &amp; attendee scores and
                  would-return rate appear here after the first verified
                  review.
                </p>
              </div>
            </div>
            <InviteReviewsButton eventId={eventId} />
          </div>
        )}

        <div className="flex items-center gap-9 px-6 py-5 lg:pl-7">
          <div>
            <p className={BAND_EYEBROW_CLASS}>Price range</p>
            <p className={cn(BAND_VAL_CLASS, "mt-1.5 text-[20px]")}>
              {priceRange ?? "—"}
            </p>
            <p className={BAND_SUB_CLASS}>
              {priceRange
                ? `per team · ${divisionCount} division${divisionCount === 1 ? "" : "s"}`
                : "no priced divisions yet"}
            </p>
          </div>
          <div>
            <p className={BAND_EYEBROW_CLASS}>Teams</p>
            <p className={cn(BAND_VAL_CLASS, "mt-1.5 text-[20px]")}>
              {teams != null ? Number(teams).toLocaleString("en-US") : "—"}
            </p>
            <p className={BAND_SUB_CLASS}>registered this year</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── age groups ────────────────────────────────────────────────────── */

/** Saturated badge gradient + soft wash, rotating per division. */
const AG_PALETTE = [
  { main: "#4f46e5", light: "#818cf8", bg: "#eef2ff", bd: "#c7d2fe", sh: "rgba(79,70,229,.5)" },
  { main: "#db2777", light: "#f472b6", bg: "#fdf2f8", bd: "#fbcfe8", sh: "rgba(219,39,119,.5)" },
  { main: "#0891b2", light: "#22d3ee", bg: "#ecfeff", bd: "#a5f3fc", sh: "rgba(8,145,178,.5)" },
  { main: "#7c3aed", light: "#a78bfa", bg: "#f5f3ff", bd: "#ddd6fe", sh: "rgba(124,58,237,.5)" },
];

export function AgeGroupCard({
  age,
  label,
  price,
  index,
}: {
  age: string;
  label: string;
  price: number | null;
  index: number;
}) {
  const p = AG_PALETTE[index % AG_PALETTE.length];
  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border px-3 py-2.5"
      style={{
        borderColor: p.bd,
        background: `linear-gradient(135deg, ${p.bg} 0%, #fff 72%)`,
      }}
    >
      <span
        className="flex h-11 w-11 flex-none items-center justify-center rounded-xl font-[var(--font-heading)] text-[13.5px] font-extrabold tracking-tight text-white"
        style={{
          background: `linear-gradient(140deg, ${p.light}, ${p.main})`,
          boxShadow: `0 5px 12px -5px ${p.sh}`,
        }}
      >
        {age}
      </span>
      <div className="min-w-0 flex-1 text-[15px] font-bold text-slate-800">
        {label}
      </div>
      <div className="font-[var(--font-heading)] text-[17px] font-extrabold tracking-tight text-slate-900">
        {price != null ? `$${formatPrice(Number(price))}` : "—"}
      </div>
    </div>
  );
}

/* ── media ─────────────────────────────────────────────────────────── */

/** Ink poster tile linking out to the event video (no embed on file). */
export function MediaVideoTile({ href }: { href: string }) {
  const domain = hostnameOf(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer nofollow"
      aria-label="Open the event video in a new tab"
      className="group relative mt-4 flex h-44 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-slate-200"
      style={{
        background:
          "linear-gradient(115deg,#0b1120 0%,#1e293b 70%,#334155 100%)",
      }}
    >
      <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-full bg-slate-900/85 px-3 py-1 font-[var(--font-heading)] text-[10px] font-extrabold uppercase tracking-[0.1em] text-white">
        Video
      </span>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 shadow-xl ring-1 ring-slate-900/10 transition-transform duration-150 group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          className="ml-0.5 h-5 w-5 fill-slate-900"
          aria-hidden="true"
        >
          <path d="M8 5.5v13l11-6.5-11-6.5z" />
        </svg>
      </span>
      <span className="max-w-[80%] truncate text-[11.5px] font-semibold text-white/60">
        {domain ? `Watch on ${domain}` : "Watch the event video"}
      </span>
    </a>
  );
}

/** Dashed invite tile for open photo slots → the editor's media step. */
export function MediaAddTile({
  editHref,
  slotsOpen,
  first,
}: {
  editHref: string;
  slotsOpen: number;
  first: boolean;
}) {
  return (
    <Link
      href={editHref as Route}
      className="flex aspect-[10/7] flex-col items-center justify-center gap-[7px] rounded-[10px] border-[1.5px] border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white transition-colors duration-150 hover:border-red-300 hover:from-red-50"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-red-600 shadow-sm">
        <Icon name="plus" className="h-4 w-4" />
      </span>
      <span className="text-[12.5px] font-bold text-slate-900">
        {first ? "Add your first photos" : "Add photos"}
      </span>
      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
        {slotsOpen} slot{slotsOpen === 1 ? "" : "s"} open
      </span>
    </Link>
  );
}

/* ── sponsors ──────────────────────────────────────────────────────── */

export function SponsorTile({
  name,
  href,
  logoSrc,
}: {
  name: string;
  href: string | null;
  logoSrc: string | null;
}) {
  const domain = href ? hostnameOf(href) : null;
  return (
    <div className="flex items-center gap-3.5 rounded-[14px] border border-slate-200 p-4 transition-colors hover:border-slate-300">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <SafeImg
          src={logoSrc ?? undefined}
          alt=""
          className="h-full w-full object-contain"
          fallback={
            <span className="grid h-full w-full place-items-center bg-amber-50 font-[var(--font-heading)] text-[15px] font-extrabold text-amber-700">
              {initialsOf(name)}
            </span>
          }
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-[var(--font-heading)] text-[14px] font-bold text-slate-900">
          {name}
        </p>
        {domain && (
          <p className="mt-0.5 truncate text-[12px] font-medium text-slate-400">
            {domain}
          </p>
        )}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer nofollow"
          className={cn(ACCENT_LINK_CLASS, "shrink-0 text-[12.5px]")}
        >
          Visit
          <Icon name="external" className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

/* ── right rail ────────────────────────────────────────────────────── */

/** Decorative venue-area sketch — a map placeholder, not real tiles. */
function MapPreview() {
  return (
    <svg viewBox="0 0 280 130" className="h-[130px] w-full" aria-hidden="true">
      <rect width="280" height="130" fill="#f1f5f9" />
      <path
        d="M-10 96 C60 82 110 108 180 92 S 260 70 300 78"
        stroke="#e2e8f0"
        strokeWidth="7"
        fill="none"
      />
      <path
        d="M-10 96 C60 82 110 108 180 92 S 260 70 300 78"
        stroke="#fff"
        strokeWidth="2.5"
        fill="none"
        strokeDasharray="7 7"
      />
      <path d="M52 -10 C64 40 44 80 70 140" stroke="#e2e8f0" strokeWidth="5" fill="none" />
      <path d="M215 -10 C200 45 236 85 220 140" stroke="#e2e8f0" strokeWidth="5" fill="none" />
      <path d="M-10 34 L300 22" stroke="#e8edf3" strokeWidth="4" fill="none" />
      <rect x="96" y="30" width="34" height="22" rx="3" fill="#e2e8f0" />
      <rect x="170" y="104" width="26" height="16" rx="3" fill="#e2e8f0" />
      <rect x="24" y="108" width="30" height="14" rx="3" fill="#e8edf3" />
      <circle cx="140" cy="65" r="17" fill="#dc2626" opacity=".14" />
      <circle cx="140" cy="65" r="10.5" fill="#dc2626" stroke="#fff" strokeWidth="2.5" />
      <circle cx="140" cy="65" r="3" fill="#fff" />
    </svg>
  );
}

export function LocationCard({
  location,
  editHref,
  canEdit,
}: {
  location: string | null;
  editHref: string;
  canEdit: boolean;
}) {
  const [primary = "", ...rest] = (location ?? "").split(/,\s*/);
  const secondary = rest.join(", ");
  const mapsHref = location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : null;
  return (
    <Card className="p-5">
      <h2 className="font-[var(--font-heading)] text-[16.5px] font-extrabold tracking-tight text-slate-900">
        Location
      </h2>
      {location ? (
        <>
          <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-200">
            <MapPreview />
          </div>
          <p className="mt-3.5 font-[var(--font-heading)] text-[14px] font-bold text-slate-900">
            {primary}
          </p>
          {secondary && (
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              {secondary}
            </p>
          )}
          {mapsHref && (
            <ButtonLink href={mapsHref} external className="mt-3.5 text-[12px]">
              Open in Google Maps
              <Icon name="external" className="h-3 w-3 text-slate-500" />
            </ButtonLink>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
            No venue set yet — add a location so attendees can find the
            event.
          </p>
          {canEdit && (
            <ButtonLink href={editHref} className="mt-3.5">
              <Icon name="pin" className="h-3.5 w-3.5 text-slate-500" />
              Add location
            </ButtonLink>
          )}
        </>
      )}
    </Card>
  );
}

export function ListingRecord({
  lifecycle,
  createdAt,
  updatedAt,
  eventId,
}: {
  lifecycle: "draft" | "active" | "canceled";
  createdAt: string;
  updatedAt: string;
  eventId: string;
}) {
  const status =
    lifecycle === "active"
      ? { label: "Published", dot: "bg-emerald-600" }
      : lifecycle === "draft"
        ? { label: "Draft", dot: "bg-amber-500" }
        : { label: "Canceled", dot: "bg-red-600" };
  return (
    <Card className="p-5">
      <h2 className="font-[var(--font-heading)] text-[16.5px] font-extrabold tracking-tight text-slate-900">
        Listing record
      </h2>
      <dl className="mt-3.5 space-y-3 text-[12.5px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium text-slate-500">Status</dt>
          <dd className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium text-slate-500">Created</dt>
          <dd className="font-semibold text-slate-800">{usDate(createdAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium text-slate-500">Last modified</dt>
          <dd className="font-semibold text-slate-800">{usDate(updatedAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="font-medium text-slate-500">Event ID</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <code
              title={eventId}
              className="truncate rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600"
            >
              {eventId.slice(0, 8)}
            </code>
            <CopyIdButton value={eventId} />
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/* ── pure helpers ──────────────────────────────────────────────────── */

export function initialsOf(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w));
  const initials = words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return initials || "TG";
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Parses the date part of an ISO string into a LOCAL date — a bare
 * `new Date("yyyy-mm-dd")` is UTC midnight, which renders as the
 * previous day west of Greenwich.
 */
function parseDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** mm/dd/yyyy (the app-wide US date rule) from an ISO date/timestamp. */
export function usDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

/** "Jul 30 – Aug 1, 2026" — the year (and month) collapse when shared. */
export function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  const s = start ? parseDateOnly(start) : null;
  const e = end ? parseDateOnly(end) : null;
  if (!s && !e) return null;
  const full: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-US", opts);
  if (s && e) {
    if (s.getTime() === e.getTime()) return fmt(s, full);
    if (s.getFullYear() === e.getFullYear()) {
      return `${fmt(s, { month: "short", day: "numeric" })} – ${fmt(e, full)}`;
    }
    return `${fmt(s, full)} – ${fmt(e, full)}`;
  }
  const only = (s ?? e)!;
  return s ? `Starts ${fmt(only, full)}` : `Ends ${fmt(only, full)}`;
}

/** "starts in 3 days" / "starts tomorrow" / "starts today", else null. */
export function startsInLabel(start: string | null): string | null {
  if (!start) return null;
  const s = parseDateOnly(start);
  if (!s) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((s.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "starts today";
  if (days === 1) return "starts tomorrow";
  return `starts in ${days} days`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
