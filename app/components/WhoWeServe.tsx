"use client";

/* WhoWeServe — "The Halfway Line".
   One unified full-width field split down the middle like a soccer pitch:
   the light Attendees territory meets the dark Organizers territory at a
   center medallion (the kickoff spot). Makes "two sides of every tournament
   weekend" literal. The CSS grid auto-equalizes both halves; every bit of
   both audiences' content is server-rendered and always in the DOM, so it's
   fully crawler- and screen-reader-reachable with no JS-gated content — the
   reveal animation is progressive enhancement only. Same palette family as
   ManifestoBand (aurora glow, marker swipes), a wholly different structure. */

import Link from "next/link";
import { useEffect, useRef } from "react";

/* Marker underline — gradient clone so the swipe wraps as text. */
function Swipe({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(transparent 62%, ${color} 62%, ${color} 94%, transparent 94%)`,
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        padding: "0 2px",
      }}
    >
      {children}
    </span>
  );
}

const ATTENDEE_POINTS = [
  "Search hundreds of events by what your team needs",
  "Read thousands of reviews from past attendees",
  "Write reviews on events you recently attended",
  "Save, favorite, and share events for later",
];

/* One contextual icon per attendee point (search / reviews / write / save),
   replacing the old 01–04 numerals. */
const ATTENDEE_ICONS: React.ReactNode[] = [
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </>,
  <path
    key="star"
    d="M12 3.6l2.6 5.25 5.8.85-4.2 4.08.99 5.76L12 16.9l-5.19 2.64.99-5.76-4.2-4.08 5.8-.85z"
  />,
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
  </>,
  <path
    key="heart"
    d="M20.8 4.6a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
  />,
];

const ORGANIZER_POINTS = [
  "List your upcoming events",
  "Showcase your event details",
  "View and respond to reviews",
  "Improve your event quality",
  "Grow your attendance",
];

const CSS = `
.wws-side { transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
.wws-side-l.wws-hidden { opacity: 0; transform: translateX(-26px); }
.wws-side-r.wws-hidden { opacity: 0; transform: translateX(26px); }

.wws-medallion { transition: opacity .5s ease .28s, transform .6s cubic-bezier(.34,1.56,.64,1) .28s; }
.wws-medallion.wws-hidden { opacity: 0; transform: translate(-50%,-50%) scale(.55); }

.wws-cta { transition: transform .2s ease, box-shadow .2s ease, background .2s ease, color .2s ease; }
.wws-cta .wws-arrow { transition: transform .2s ease; }
.wws-cta:hover .wws-arrow, .wws-cta:focus-visible .wws-arrow { transform: translateX(4px); }
.wws-cta-solid {
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%);
  box-shadow: 0 10px 24px -8px rgba(220,38,38,.52);
}
.wws-cta-solid:hover {
  background: linear-gradient(135deg, var(--color-accent-dark) 0%, #9d1616 100%);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px -8px rgba(220,38,38,.60);
}
.wws-cta-light {
  background: #fff;
  box-shadow: 0 10px 24px -10px rgba(0,0,0,.55), inset 0 0 0 1px rgba(15,23,42,.06);
}
.wws-cta-light:hover {
  background: var(--color-gold-bright);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px -10px rgba(251,191,36,.45);
}

@media (prefers-reduced-motion: reduce) {
  .wws-side, .wws-medallion, .wws-cta, .wws-cta .wws-arrow { transition: none !important; }
  .wws-hidden { opacity: 1 !important; transform: none !important; }
  .wws-medallion.wws-hidden { transform: translate(-50%,-50%) !important; }
  .wws-cta:hover { transform: none; }
}
`;

export function WhoWeServe() {
  const rootRef = useRef<HTMLDivElement>(null);

  /* Progressive-enhancement reveal — the two territories slide in toward the
     halfway line as the field scrolls into view. Only arms elements still
     below the fold at hydration, and never runs under reduced-motion. Content
     is fully rendered without this; it purely animates. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const field = root.querySelector<HTMLElement>(".wws-field");
    if (!field) return;
    if (field.getBoundingClientRect().top <= window.innerHeight * 0.92) return;

    const targets = Array.from(
      field.querySelectorAll<HTMLElement>(".wws-side, .wws-medallion")
    );
    targets.forEach((el) => el.classList.add("wws-hidden"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            targets.forEach((el) => el.classList.remove("wws-hidden"));
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(field);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="mt-9">
      <style>{CSS}</style>

      <div
        className="wws-field relative grid grid-cols-1 overflow-hidden rounded-[28px] md:grid-cols-2"
        style={{
          border: "1px solid var(--color-border)",
          boxShadow: "0 2px 6px rgba(15,23,42,.05)",
        }}
      >
        <AttendeesSide />
        <OrganizersSide />
        <CenterMedallion />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Left territory — Event Attendees (light)
   ═══════════════════════════════════════════════════ */

function AttendeesSide() {
  return (
    <section
      aria-labelledby="wws-attendees-h"
      className="wws-side wws-side-l relative flex flex-col overflow-hidden p-[clamp(22px,3vw,38px)] md:pr-[clamp(40px,4.5vw,64px)]"
      style={{
        background: "linear-gradient(160deg, #ffffff 52%, #fef2f2 100%)",
      }}
    >
      {/* Faint mowing stripes + corner wash — subtle pitch texture */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(15,23,42,.022) 0 44px, transparent 44px 88px)," +
            "radial-gradient(340px 240px at 100% -12%, rgba(220,38,38,.07), transparent 66%)",
        }}
      />

      <div className="relative flex min-h-full flex-col">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full uppercase"
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: ".13em",
            color: "var(--color-accent)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "7px 15px",
            fontFamily: "var(--font-mono)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
            <path d="M9 11.5l2 2 4-4.5" />
          </svg>
          Event Attendees
        </span>

        <h3
          id="wws-attendees-h"
          className="font-heading text-dark"
          style={{
            fontSize: "clamp(22px, 2.4vw, 28px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.06,
            margin: "15px 0 0",
          }}
        >
          Go in <Swipe color="rgba(220,38,38,.24)">knowing</Swipe>.
        </h3>

        <p
          className="mt-3 mb-0"
          style={{
            fontSize: 14.5,
            lineHeight: 1.58,
            color: "var(--color-text-secondary)",
            maxWidth: 440,
          }}
        >
          Coaches, parents, and team managers — decide with the whole picture
          before you commit a weekend and real money.
        </p>

        {/* Checklist — contextual icons, dash-ruled */}
        <ul className="mt-6 mb-0 flex flex-col" style={{ listStyle: "none", padding: 0 }}>
          {ATTENDEE_POINTS.map((p, i) => (
            <li
              key={p}
              className="flex items-center gap-3.5"
              style={{
                padding: "10px 2px",
                borderTop: i === 0 ? "none" : "1px dashed #fecaca",
              }}
            >
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: "#fff",
                  border: "1.5px solid #fecaca",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {ATTENDEE_ICONS[i]}
                </svg>
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 550,
                  color: "var(--color-dark-light)",
                  lineHeight: 1.4,
                }}
              >
                {p}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-7">
          <Link
            href="/events"
            className="wws-cta wws-cta-solid font-heading group inline-flex items-center gap-2 rounded-full text-white no-underline"
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              padding: "11px 22px",
            }}
          >
            Browse tournaments
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   Right territory — Event Organizers (dark)
   ═══════════════════════════════════════════════════ */

function OrganizersSide() {
  return (
    <section
      aria-labelledby="wws-organizers-h"
      className="wws-side wws-side-r relative flex flex-col overflow-hidden p-[clamp(22px,3vw,38px)] md:pl-[clamp(40px,4.5vw,64px)]"
      style={{
        background: "linear-gradient(200deg, #1e293b 0%, #0f172a 76%)",
        boxShadow: "inset 10px 0 34px -18px rgba(0,0,0,.6)",
      }}
    >
      {/* Aurora glow + faint mowing stripes */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(380px 260px at 12% -14%, rgba(220,38,38,.20), transparent 62%)," +
            "radial-gradient(360px 260px at 104% 16%, rgba(0,77,255,.13), transparent 60%)," +
            "radial-gradient(320px 240px at 86% 112%, rgba(245,158,11,.11), transparent 60%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,.02) 0 44px, transparent 44px 88px)",
        }}
      />

      {/* Growth sparkline watermark — ascending, gold at the peak */}
      <svg
        viewBox="0 0 220 120"
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -14,
          bottom: -12,
          width: 208,
          height: 114,
          pointerEvents: "none",
        }}
      >
        <path
          d="M8,104 L58,86 L96,92 L138,60 L172,66 L206,26"
          fill="none"
          stroke="rgba(255,255,255,.09)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="206" cy="26" r="4.5" fill="rgba(251,191,36,.55)" />
      </svg>

      <div className="relative flex min-h-full flex-col">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full uppercase"
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: ".13em",
            color: "var(--color-gold-bright)",
            background: "rgba(255,255,255,.07)",
            border: "1px solid rgba(255,255,255,.14)",
            padding: "7px 15px",
            fontFamily: "var(--font-mono)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M14 7h7v7" />
          </svg>
          Event Organizers
        </span>

        <h3
          id="wws-organizers-h"
          className="font-heading text-white"
          style={{
            fontSize: "clamp(22px, 2.4vw, 28px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.06,
            margin: "15px 0 0",
          }}
        >
          Grow your{" "}
          <Swipe color="rgba(251,191,36,.30)">reputation</Swipe>.
        </h3>

        <p
          className="mt-3 mb-0"
          style={{
            fontSize: 14.5,
            lineHeight: 1.58,
            color: "rgba(255,255,255,.75)",
            maxWidth: 430,
          }}
        >
          Put your tournament in front of thousands of active teams and let
          honest feedback build your reputation season over season.
        </p>

        {/* Growth ledger — gold trend marks, hairline-ruled */}
        <ul className="mt-6 mb-0 flex flex-col" style={{ listStyle: "none", padding: 0 }}>
          {ORGANIZER_POINTS.map((p, i) => (
            <li
              key={p}
              className="flex items-center gap-3.5"
              style={{
                padding: "10px 2px",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,.09)",
              }}
            >
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: "rgba(251,191,36,.12)",
                  border: "1px solid rgba(251,191,36,.28)",
                }}
              >
                <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold-bright)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17L17 7" />
                  <path d="M9 7h8v8" />
                </svg>
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "rgba(255,255,255,.88)",
                  lineHeight: 1.4,
                }}
              >
                {p}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-7">
          <Link
            href="/host"
            className="wws-cta wws-cta-light font-heading group inline-flex items-center gap-2 rounded-full no-underline"
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              padding: "11px 22px",
              color: "var(--color-dark)",
            }}
          >
            List your event
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   Center medallion — the kickoff spot on the halfway line.
   A split coin (light / dark) straddling the seam. Desktop flourish.
   ═══════════════════════════════════════════════════ */

function CenterMedallion() {
  return (
    <div
      className="wws-medallion hidden md:flex md:items-center md:justify-center"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        width: 66,
        height: 66,
        borderRadius: "50%",
        background: "linear-gradient(90deg, #fdecec 0 50%, #101a2e 50% 100%)",
        border: "2px solid #fff",
        boxShadow:
          "0 12px 26px -8px rgba(15,23,42,.5), 0 0 0 1px rgba(15,23,42,.06)",
        zIndex: 3,
      }}
    >
      {/* center circle ring */}
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: 32,
          height: 32,
          border: "1.5px solid rgba(148,163,184,.85)",
        }}
      >
        <span
          className="rounded-full"
          style={{ width: 6, height: 6, background: "rgba(148,163,184,.95)" }}
        />
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      className="wws-arrow"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
