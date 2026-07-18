/* card-bits.tsx — shared card primitives (calendar tile, pills, rating badge,
   save heart) reused across the featured-event showcase. Mirrors the prototype's
   card-art.jsx / cards.jsx craft so every surface reads as one design family. */

import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "@/app/components/ui/SafeImg";

const STAR_PATH =
  "M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z";

export function fmtDateRange(start?: string | null, end?: string | null) {
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

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function Pill({ children }: { children: React.ReactNode }) {
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

/* Calendar date tile — month band + day number. `size="lg"` for the hero
   feature, default compact for supporting cards. */
export function CalendarDate({
  start,
  end,
  size = "sm",
}: {
  start: string;
  end?: string | null;
  size?: "sm" | "lg";
}) {
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
  const lg = size === "lg";

  return (
    <div
      className="inline-flex shrink-0 flex-col items-stretch overflow-hidden text-center"
      style={{
        borderRadius: lg ? 12 : 10,
        border: "1px solid #e2e8f0",
        background: "#fff",
        minWidth: lg ? 62 : 50,
        lineHeight: 1,
        boxShadow: lg ? "0 2px 7px rgba(15,23,42,.09)" : "none",
      }}
    >
      <div
        style={{
          background: "#64748b",
          color: "#fff",
          fontSize: lg ? 9.5 : 8.5,
          fontWeight: 700,
          letterSpacing: ".1em",
          padding: lg ? "5px 12px" : "4px 10px",
        }}
      >
        {header}
      </div>
      <div
        className="font-heading"
        style={{
          fontSize: lg ? 17 : 13,
          fontWeight: 800,
          color: "var(--color-dark)",
          padding: lg ? "8px 12px 9px" : "5px 10px 6px",
          letterSpacing: "-0.01em",
        }}
      >
        {days}
      </div>
    </div>
  );
}

/* Dark gradient rating badge with glowing gold star — the prototype signature. */
export function RatingBadge({
  rating,
  count,
}: {
  rating: number;
  count: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        background: "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
        border: "1px solid rgba(255,255,255,.08)",
        padding: "6px 8px 6px 11px",
        boxShadow:
          "0 6px 16px -4px rgba(15,23,42,.4), inset 0 1px 0 rgba(255,255,255,.14)",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="var(--color-gold-bright)"
        stroke="var(--color-gold-bright)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,.55))" }}
        aria-hidden="true"
      >
        <path d={STAR_PATH} />
      </svg>
      <b
        className="font-heading text-[14px] font-extrabold text-white"
        style={{ letterSpacing: "-0.01em" }}
      >
        {rating.toFixed(1)}
      </b>
      <span
        className="rounded-full text-[11px] font-bold"
        style={{
          color: "rgba(255,255,255,.85)",
          background: "rgba(255,255,255,.14)",
          padding: "2px 8px",
        }}
      >
        {count}
      </span>
    </span>
  );
}

/* Save heart — decorative on a link card (the whole card is the link). */
export function SaveHeart({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border"
      style={{
        width: size,
        height: size,
        borderColor: "#e2e8f0",
        background: "#fff",
        color: "#94a3b8",
      }}
    >
      <svg
        width={Math.round(size * 0.53)}
        height={Math.round(size * 0.53)}
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
    </span>
  );
}

export function IconPin() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

/* Featured badge — red gradient + gold star, matches the prototype GridCard. */
export function FeaturedBadge() {
  return (
    <span
      className="font-heading inline-flex items-center gap-1.5 uppercase text-white"
      style={{
        background:
          "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".07em",
        padding: "5px 10px 5px 7px",
        borderRadius: 8,
        boxShadow: "0 4px 12px -3px rgba(220,38,38,.5)",
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="var(--color-gold-bright)"
        stroke="var(--color-gold-bright)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d={STAR_PATH} />
      </svg>
      Featured
    </span>
  );
}

/* Logo panel — event logo contained on a clean branded backdrop, matching
   card-art.jsx. Falls back to a TG monogram. */
export function LogoPanel({
  logo,
  title,
  className,
  style,
  texture,
}: {
  logo: string | null;
  title: string;
  className?: string;
  style?: React.CSSProperties;
  /* When set, render a large, blurred, desaturated soccer ball cropped by the
     panel edges as a designed background texture (used by the featured cards).
     Left off elsewhere so the compact promo strips keep the plain mark. */
  texture?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #f3f6fa 60%, #e9eef5 100%)",
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(130% 80% at 50% -12%, rgba(255,255,255,.92), transparent 70%)",
        }}
      />
      {/* In `texture` mode (featured cards) the panel is left as a clean, soft
         neutral gradient — no ball. Elsewhere (compact promo strips) a faint
         centered soccer ball fills the transparent gaps in logo PNGs and stands
         in as the mark when there's no logo. */}
      {!texture && (
        <span
          aria-hidden="true"
          className="tg-ball pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span style={{ fontSize: 90, lineHeight: 1, opacity: logo ? 0.08 : 0.18 }}>
            ⚽
          </span>
        </span>
      )}
      {safeImageSrc(logo) && (
        // Broken logo → SafeImg vanishes and the ⚽ / gradient backdrop
        // stands in, same as no-logo.
        <SafeImg
          src={safeImageSrc(logo)!}
          alt={`${title} logo`}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            maxWidth: "82%",
            maxHeight: "82%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 3px 8px rgba(15,23,42,.12))",
          }}
        />
      )}
    </div>
  );
}
