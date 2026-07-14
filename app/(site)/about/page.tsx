import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  getEventDirectors,
  type EventDirectorRow,
} from "@/lib/supabase/queries";
import { DirectorPortrait } from "@/app/components/DirectorPortrait";

export const metadata: Metadata = {
  title: "About Us · Tournament Guru",
  description:
    "Our mission is simple. Make the tournament selection process easier for coaches & managers and help Tournament Directors improve their event offering.",
};

const PAGE_SIZE = 12;

/* ─────────────────────────────────────────────────────────────────
   About Us · marketing page

   Sits on the SAME aurora backdrop as the landing page — the hero
   covers the top with a full-bleed image; the aurora shows through
   below and behind the "Meet Our Team" grid. Cards frame the
   directors with a 2 px white border, deep round corners, and a
   soft multi-layer shadow so they read as premium chips floating
   on the aurora. Aggregate data (events posted / avg rating / total
   reviews) comes from the get_event_directors RPC (migration
   000014) — pinned three at the top, rest recency-sorted.
   ───────────────────────────────────────────────────────────────── */
export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = clampPage(sp.page);

  const directors = await getEventDirectors({ page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(directors.total / PAGE_SIZE));

  return (
    /* Landing-page aurora background, verbatim — same #eef2f9 base and
       the same four radial gradients (fixed attachment). */
    <div
      style={{
        backgroundColor: "#eef2f9",
        backgroundImage:
          "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.13), transparent 56%)," +
          "radial-gradient(980px 600px at 104% -8%, rgba(0,77,255,.10), transparent 56%)," +
          "radial-gradient(820px 820px at 100% 50%, rgba(245,158,11,.07), transparent 60%)," +
          "radial-gradient(1000px 900px at 40% 126%, rgba(124,58,237,.07), transparent 60%)",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* ═══════════════════════════════════════════════════
         HERO — full-bleed background image with dark overlay
         Content is centered inside; shorter than the landing
         hero. Pill is a solid red gradient with a halo glow;
         subtext gets a marker underline under its key phrase.
         ═══════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ isolation: "isolate" }}
      >
        <div className="absolute inset-0 z-0">
          <Image
            src="/fancy-crave-qowyMze7jqg-unsplash.webp"
            alt="Soccer stadium at kickoff"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,14,22,.44) 0%, rgba(9,13,20,.60) 34%, rgba(8,11,18,.74) 66%, rgba(6,9,16,.84) 100%)",
            }}
          />
        </div>

        <div
          className="relative z-10 mx-auto w-full max-w-[880px] px-6 text-center"
          style={{
            paddingTop: "clamp(56px, 8vw, 96px)",
            paddingBottom: "clamp(56px, 8vw, 96px)",
          }}
        >
          <AboutPill />

          <h1
            className="font-heading mx-auto"
            style={{
              marginTop: 26,
              fontSize: "clamp(38px, 6.4vw, 60px)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.03,
              color: "#fff",
              maxWidth: 780,
              textWrap: "balance",
              textShadow: "0 2px 24px rgba(0,0,0,.4)",
            }}
          >
            Tournament{" "}
            <HighlightSwipe>
              <span style={{ color: "#fff" }}>Gurus</span>
            </HighlightSwipe>{" "}
            Mission
          </h1>

          <p
            className="mx-auto mb-0"
            style={{
              marginTop: 22,
              fontSize: "clamp(16px, 1.7vw, 19px)",
              lineHeight: 1.65,
              color: "rgba(255,255,255,.92)",
              maxWidth: 680,
              fontWeight: 500,
              textWrap: "balance",
              textShadow: "0 2px 14px rgba(0,0,0,.4)",
            }}
          >
            Our mission is simple.{" "}
            <MarkerUnderlineDark>
              Make the tournament selection process easier for coaches &amp;
              managers
            </MarkerUnderlineDark>{" "}
            and help{" "}
            <b style={{ fontWeight: 700, color: "#fff" }}>
              Tournament Directors
            </b>{" "}
            improve their event offering.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
         MEET OUR TEAM  (transparent — aurora shows through)
         ═══════════════════════════════════════════════════ */}
      <section
        className="relative"
        style={{ background: "transparent" }}
        aria-labelledby="meet-our-team"
      >
        <div
          className="mx-auto max-w-[1240px]"
          style={{ padding: "clamp(56px, 7vw, 96px) 24px" }}
        >
          <h2
            id="meet-our-team"
            className="font-heading text-center text-dark"
            style={{
              fontSize: "clamp(24px, 3.6vw, 34px)",
              fontWeight: 800,
              letterSpacing: ".01em",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            Meet Our Team
          </h2>

          {/* Flex-wrap grid — cards at a fixed width so partial final rows
             centre naturally. Bumped from gap-6 → gap-8 for more air. */}
          {directors.data.length > 0 ? (
            <ul
              className="flex flex-wrap justify-center gap-8 list-none p-0"
              style={{ margin: "48px auto 0" }}
            >
              {directors.data.map((d) => (
                <li
                  key={d.id}
                  className="w-full sm:w-[272px]"
                  style={{ display: "flex" }}
                >
                  <DirectorCard director={d} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-12">
              <EmptyState source={directors.source} />
            </div>
          )}

          {directors.data.length > 0 && totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} />
          )}
        </div>
      </section>
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   About Us label — frosted-glass pill on the dark hero.
   Kept intentionally non-button: no solid fill, no halo
   glow, no motion. Reads as a section eyebrow/tag; the
   red comes in only as a small indicator dot so the
   brand still touches the label.
   ═════════════════════════════════════════════════════ */
function AboutPill() {
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full"
      style={{
        padding: "10px 20px 10px 16px",
        background:
          "linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 100%)",
        border: "1px solid rgba(255,255,255,.28)",
        boxShadow:
          "0 4px 18px -8px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.22)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <span
        aria-hidden="true"
        className="inline-flex rounded-full"
        style={{
          width: 7,
          height: 7,
          background: "var(--color-accent)",
          boxShadow: "0 0 10px rgba(220,38,38,.9)",
        }}
      />
      <span
        className="font-heading uppercase"
        style={{
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: ".22em",
          color: "rgba(255,255,255,.96)",
          lineHeight: 1,
        }}
      >
        About Us
      </span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   HighlightSwipe — hand-drawn marker swipe reused from
   the landing page.
   ═════════════════════════════════════════════════════ */
function HighlightSwipe({
  children,
  color = "rgba(220,38,38,.48)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <svg
        viewBox="0 0 200 44"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-3%",
          top: "-6%",
          width: "106%",
          height: "112%",
          zIndex: 0,
        }}
      >
        <path
          d="M6,26 C44,12 96,30 148,16 C176,9 194,20 197,14 C198,30 196,36 190,38 C150,46 104,28 58,38 C34,43 10,34 4,38 C2,32 2,30 6,26 Z"
          fill={color}
        />
      </svg>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

/* Marker underline that wraps naturally across lines — same technique
   the landing's ManifestoBand uses under "difficult" and "real reviews". */
function MarkerUnderlineDark({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        color: "#fff",
        fontWeight: 700,
        backgroundImage:
          "linear-gradient(transparent 58%, rgba(220,38,38,.44) 58%, rgba(220,38,38,.44) 92%, transparent 92%)",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        padding: "0 3px",
        borderRadius: 2,
      }}
    >
      {children}
    </span>
  );
}

/* ═════════════════════════════════════════════════════
   Director card
   Photo + name + role, then a row of three stat chips
   (events posted / avg rating / review count). No email.
   Framed with a 2px white border, deep rounded corners,
   and a soft multi-layer shadow so it lifts off the
   aurora background.
   ═════════════════════════════════════════════════════ */
function DirectorCard({ director }: { director: EventDirectorRow }) {
  const {
    display_name,
    profile_picture,
    event_count,
    total_reviews,
    avg_rating,
  } = director;
  const hasRating = total_reviews > 0 && avg_rating > 0;

  return (
    <article
      className="group relative flex w-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "#fff",
        border: "2px solid #fff",
        borderRadius: 26,
        boxShadow:
          "0 30px 60px -30px rgba(15,23,42,.28), 0 12px 26px -12px rgba(15,23,42,.14), 0 2px 4px rgba(15,23,42,.05)",
      }}
    >
      {/* Portrait */}
      <div className="relative w-full" style={{ aspectRatio: "4 / 5" }}>
        <DirectorPortrait src={profile_picture} name={display_name} />
      </div>

      {/* Content */}
      <div
        className="flex flex-1 flex-col"
        style={{ padding: "18px 20px 22px" }}
      >
        <h3
          className="font-heading"
          style={{
            fontSize: 17.5,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-dark)",
            lineHeight: 1.2,
            textWrap: "balance",
          }}
        >
          {display_name}
        </h3>

        <div
          style={{
            marginTop: 4,
            fontSize: 13.5,
            color: "var(--color-text-muted)",
            fontWeight: 500,
          }}
        >
          Event Director
        </div>

        {/* Stat chip row */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <StatChip
            tone="accent"
            icon={<CalendarIcon />}
            value={formatCompact(event_count)}
            label={event_count === 1 ? "event" : "events"}
            aria={`${event_count} events posted`}
          />
          {hasRating ? (
            <>
              <StatChip
                tone="gold"
                icon={<StarIcon />}
                value={avg_rating.toFixed(1)}
                label="rating"
                aria={`${avg_rating.toFixed(1)} out of 5 average rating`}
              />
              <StatChip
                tone="neutral"
                icon={<CommentIcon />}
                value={formatCompact(total_reviews)}
                label={total_reviews === 1 ? "review" : "reviews"}
                aria={`${total_reviews} reviews`}
              />
            </>
          ) : (
            <NoRatingChip />
          )}
        </div>
      </div>
    </article>
  );
}

type Tone = "accent" | "gold" | "neutral";

function StatChip({
  tone,
  icon,
  value,
  label,
  aria,
}: {
  tone: Tone;
  icon: React.ReactNode;
  value: string;
  label: string;
  aria: string;
}) {
  const style = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        padding: "4px 10px 4px 8px",
      }}
      aria-label={aria}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center"
        style={{ color: style.icon }}
      >
        {icon}
      </span>
      <b
        className="font-heading"
        style={{
          fontSize: 12.5,
          fontWeight: 800,
          color: "var(--color-dark)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </b>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>
    </span>
  );
}

function NoRatingChip() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "4px 10px 4px 8px",
      }}
    >
      <span aria-hidden="true" style={{ color: "#cbd5e1" }}>
        <StarIcon />
      </span>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
        }}
      >
        No ratings yet
      </span>
    </span>
  );
}

const TONES: Record<Tone, { bg: string; border: string; icon: string }> = {
  accent: {
    bg: "rgba(220,38,38,.08)",
    border: "rgba(220,38,38,.24)",
    icon: "var(--color-accent)",
  },
  gold: {
    bg: "rgba(245,158,11,.10)",
    border: "rgba(245,158,11,.34)",
    icon: "var(--color-gold)",
  },
  neutral: {
    bg: "var(--color-surface-alt)",
    border: "var(--color-border)",
    icon: "var(--color-text-muted)",
  },
};

/* ═════════════════════════════════════════════════════
   Icons
   ═════════════════════════════════════════════════════ */

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 01-11.7 7.1L4 20l1-4.5A8 8 0 1121 12z" />
    </svg>
  );
}

/* ═════════════════════════════════════════════════════
   Empty state — on-brand fallback when the RPC hasn't
   returned any rows (e.g. migration not yet applied).
   ═════════════════════════════════════════════════════ */
function EmptyState({ source }: { source: "rpc" | "unavailable" }) {
  const isUnavailable = source === "unavailable";
  return (
    <div
      className="mx-auto flex max-w-[520px] flex-col items-center rounded-3xl bg-white text-center"
      style={{
        padding: "48px 32px",
        border: "2px solid #fff",
        boxShadow:
          "0 30px 60px -30px rgba(15,23,42,.28), 0 12px 26px -12px rgba(15,23,42,.14), 0 2px 4px rgba(15,23,42,.05)",
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background: "var(--color-surface-alt)",
          color: "var(--color-text-muted)",
        }}
        aria-hidden="true"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </span>
      <h3
        className="font-heading mt-4"
        style={{
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--color-dark)",
        }}
      >
        Team profiles are on the way
      </h3>
      <p
        className="mt-2"
        style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--color-text-secondary)",
        }}
      >
        {isUnavailable
          ? "Our directors directory is being finalized. Check back shortly — new profiles are being added."
          : "There aren't any published directors yet. Once events go live, the people behind them will show up here."}
      </p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   Pagination — URL-preserved via ?page=. Prev · numbers
   with ellipses · Next.
   ═════════════════════════════════════════════════════ */
function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const items = buildPageItems(page, totalPages);
  return (
    <nav
      aria-label="Team directory pages"
      className="mt-14 flex flex-wrap items-center justify-center gap-2"
    >
      <PageLink
        href={hrefFor(page - 1)}
        disabled={page <= 1}
        label="Previous page"
      >
        <ArrowLeft />
        <span className="hidden sm:inline">Previous</span>
      </PageLink>

      <ul className="flex flex-wrap items-center gap-1.5 list-none p-0 m-0">
        {items.map((it, i) =>
          it === "…" ? (
            <li
              key={`gap-${i}`}
              aria-hidden="true"
              style={{ color: "var(--color-text-faint)", padding: "0 6px" }}
            >
              …
            </li>
          ) : (
            <li key={it}>
              <PageNumber href={hrefFor(it)} n={it} current={it === page} />
            </li>
          ),
        )}
      </ul>

      <PageLink
        href={hrefFor(page + 1)}
        disabled={page >= totalPages}
        label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ArrowRight />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 13.5,
    fontWeight: 600,
    borderRadius: 10,
    border: "1px solid var(--color-border)",
    color: disabled ? "var(--color-text-faint)" : "var(--color-dark)",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    textDecoration: "none",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    transition:
      "background .15s ease, border-color .15s ease, transform .12s ease",
  };
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} style={style}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      style={style}
      className="hover:bg-[var(--color-surface)]"
    >
      {children}
    </Link>
  );
}

function PageNumber({
  href,
  n,
  current,
}: {
  href: string;
  n: number;
  current: boolean;
}) {
  const style: React.CSSProperties = {
    minWidth: 40,
    padding: "10px 12px",
    fontSize: 13.5,
    fontWeight: 700,
    borderRadius: 10,
    border: `1px solid ${current ? "var(--color-accent)" : "var(--color-border)"}`,
    background: current
      ? "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))"
      : "#fff",
    color: current ? "#fff" : "var(--color-dark)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    letterSpacing: "-0.01em",
    boxShadow: current ? "0 8px 20px -8px rgba(220,38,38,.5)" : undefined,
    transition: "background .15s ease, border-color .15s ease",
  };

  if (current) {
    return (
      <span aria-current="page" aria-label={`Page ${n}`} style={style}>
        {n}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={`Go to page ${n}`}
      style={style}
      className="hover:bg-[var(--color-surface)]"
    >
      {n}
    </Link>
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/* ═════════════════════════════════════════════════════
   Helpers
   ═════════════════════════════════════════════════════ */

function clampPage(v: string | string[] | undefined): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function hrefFor(page: number): string {
  return page <= 1 ? "/about" : `/about?page=${page}`;
}

function buildPageItems(current: number, total: number): (number | "…")[] {
  const WINDOW = 1;
  const items: (number | "…")[] = [];
  const push = (v: number | "…") => {
    if (items[items.length - 1] !== v) items.push(v);
  };
  for (let i = 1; i <= total; i++) {
    const isEdge = i === 1 || i === total;
    const inWindow = Math.abs(i - current) <= WINDOW;
    if (isEdge || inWindow) push(i);
    else if (i < current) push("…");
    else if (i > current) push("…");
  }
  return items;
}

function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}
