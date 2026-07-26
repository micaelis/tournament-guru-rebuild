"use client";

/*
 * ShareExperienceIntro — Section 2's living intro.
 *
 * The prompt ("Share Your Event Experience") sits directly above its payoff
 * (Recent Reviews). Its interactive centerpiece is a star-rating teaser:
 * hovering the stars fills them gold and the caption reacts, and clicking any
 * star — or the Write a Review button — opens the shared EventSearchOverlay in
 * REVIEW mode. The event must be picked before the review form, so the overlay
 * is the gate.
 */

import { useState } from "react";
import { EventSearchOverlay } from "../EventSearchOverlay";

const STAR_PATH =
  "M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z";

const CAPTIONS = [
  "Rate the event you attended",
  "Not great — tell coaches why",
  "It was okay",
  "Pretty good weekend",
  "Great — worth the trip",
  "Best tournament of the season",
];

export function ShareExperienceIntro() {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);

  const shown = hover; // stars filled up to the hovered index
  const caption = CAPTIONS[shown] ?? CAPTIONS[0];

  return (
    <>
      <div
        className="relative overflow-hidden rounded-[28px]"
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
          boxShadow: "0 28px 70px -34px rgba(15,23,42,.7)",
        }}
      >
        {/* brand glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            bottom: -120,
            left: -80,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,38,38,.30), transparent 66%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: -100,
            right: -70,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(251,191,36,.16), transparent 68%)",
          }}
        />

        <div
          className="relative flex flex-col gap-7"
          style={{ padding: "clamp(26px, 4vw, 44px)" }}
        >
          {/* Copy side */}
          <div className="min-w-0">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span
                className="shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: "var(--color-gold-bright)" }}
                aria-hidden="true"
              />
              <span
                className="font-heading uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--color-gold-bright)",
                  letterSpacing: ".14em",
                }}
              >
                Tournament Reviews
              </span>
            </div>

            <h2
              className="font-heading"
              style={{
                fontSize: "clamp(22px, 2.6vw, 30px)",
                fontWeight: 800,
                letterSpacing: "-0.028em",
                lineHeight: 1.12,
                margin: 0,
                color: "#fff",
                textWrap: "balance",
              }}
            >
              Share Your Event Experience
            </h2>

            <p
              className="mt-4 mb-0"
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: "rgba(255,255,255,.72)",
              }}
            >
              Publish your recent event experience allowing future potential
              event attendees to make a more educated decision and provide
              tournament directors your valuable insight so they can continue to
              improve their event for the future.
            </p>
          </div>

          {/* Interactive rating + CTA side */}
          <div className="min-w-0">
            <div
              className="rounded-[22px]"
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.12)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                padding: "22px 22px 20px",
              }}
            >
              <div
                className="font-heading uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  color: "rgba(255,255,255,.55)",
                }}
              >
                How was it?
              </div>

              {/* Interactive stars */}
              <div
                className="mt-3 flex items-center gap-1.5"
                onMouseLeave={() => setHover(0)}
                role="group"
                aria-label="Rate and write a review"
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = i < shown;
                  return (
                    <button
                      key={i}
                      type="button"
                      onMouseEnter={() => setHover(i + 1)}
                      onFocus={() => setHover(i + 1)}
                      onClick={() => setOpen(true)}
                      aria-label={`Rate ${i + 1} star${i ? "s" : ""} and write a review`}
                      className="cursor-pointer bg-transparent p-0.5 transition-transform hover:scale-110"
                    >
                      <svg
                        width="34"
                        height="34"
                        viewBox="0 0 24 24"
                        fill={filled ? "var(--color-gold-bright)" : "rgba(255,255,255,.16)"}
                        stroke={filled ? "var(--color-gold-bright)" : "rgba(255,255,255,.34)"}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                        style={{
                          filter: filled
                            ? "drop-shadow(0 0 6px rgba(251,191,36,.55))"
                            : "none",
                          transition: "fill .12s, stroke .12s, filter .12s",
                        }}
                        aria-hidden="true"
                      >
                        <path d={STAR_PATH} />
                      </svg>
                    </button>
                  );
                })}
              </div>

              <div
                className="mt-2.5"
                style={{ fontSize: 13.5, color: "rgba(255,255,255,.8)", fontWeight: 500, minHeight: 20 }}
              >
                {caption}
              </div>

              <button
                type="button"
                onClick={() => setOpen(true)}
                className="font-heading mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-white transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  background:
                    "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
                  boxShadow: "0 12px 28px -8px rgba(220,38,38,.6)",
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Write a Review
              </button>

              <div
                className="mt-3 flex items-center justify-center gap-1.5"
                style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)" }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Pick the event first, then rate the details
              </div>
            </div>
          </div>
        </div>
      </div>

      <EventSearchOverlay
        open={open}
        onClose={() => setOpen(false)}
        mode="review"
      />
    </>
  );
}
