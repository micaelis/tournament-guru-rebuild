"use client";

import { useState } from "react";

export function SponsoredBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl"
      style={{
        background: "#0b1226",
        boxShadow:
          "0 18px 40px -18px rgba(8, 12, 32, .55), 0 1px 0 rgba(255,255,255,.04) inset",
      }}
    >
      {/* Aurora background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 z-0 animate-aurora"
        style={{
          background:
            "radial-gradient(60% 80% at 18% 10%, rgba(99,102,241,.55), transparent 60%)," +
            "radial-gradient(50% 90% at 78% 110%, rgba(244,63,94,.45), transparent 65%)," +
            "radial-gradient(45% 60% at 95% 20%, rgba(56,189,248,.28), transparent 70%)",
          filter: "saturate(1.05)",
        }}
      />

      {/* Sheen + vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,.05), transparent 30%)," +
            "radial-gradient(120% 80% at 50% 120%, rgba(0,0,0,.45), transparent 60%)",
        }}
      />

      {/* Grain */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
        style={{ opacity: 0.12, mixBlendMode: "overlay" }}
      >
        <filter id="tg-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            stitchTiles="stitch"
          />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .65 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#tg-grain)" />
      </svg>

      {/* Content */}
      <div
        className="relative z-[3] grid items-center gap-4"
        style={{
          gridTemplateColumns: "1fr auto",
          padding: "16px 16px 16px 20px",
        }}
      >
        <div className="min-w-0">
          {/* Sponsor pill */}
          <span
            className="font-heading inline-flex items-center gap-2 rounded-full"
            style={{
              padding: "4px 10px 4px 8px",
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.14)",
              backdropFilter: "blur(6px)",
              color: "rgba(255,255,255,.92)",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".16em",
              textTransform: "uppercase",
            }}
          >
            <span
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: "#a5b4fc",
                boxShadow: "0 0 10px rgba(165,180,252,.85)",
              }}
            />
            Sponsored
            <span style={{ color: "rgba(255,255,255,.35)" }}>&middot;</span>
            <span style={{ color: "rgba(255,255,255,.7)" }}>
              Apex 11 Athletic
            </span>
          </span>

          <h3
            className="font-heading mt-2 mb-0 text-white"
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              textWrap: "balance",
            }}
          >
            Win a full Apex&nbsp;11 team kit for your squad
          </h3>
          <p
            className="mt-1 mb-0"
            style={{
              fontSize: 13,
              color: "rgba(226,232,240,.78)",
              lineHeight: 1.5,
              maxWidth: 520,
            }}
          >
            Register a U10&ndash;U14 roster for any eligible tournament by
            July&nbsp;1 to enter.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss ad"
            className="cursor-pointer rounded-full bg-white/10 transition-colors hover:bg-white/25"
            style={{
              width: 26,
              height: 26,
              border: "1px solid rgba(255,255,255,.14)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
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
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>

          <a
            href="#"
            className="font-heading inline-flex items-center gap-2 rounded-full bg-white text-[13px] font-bold no-underline transition-shadow hover:shadow-lg"
            style={{
              padding: "9px 14px 9px 16px",
              color: "#0b1226",
              letterSpacing: "-0.005em",
            }}
          >
            See eligible events
            <svg
              width="14"
              height="14"
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
          </a>
        </div>
      </div>
    </div>
  );
}
