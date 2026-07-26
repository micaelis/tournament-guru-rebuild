"use client";

/*
 * FindTournamentIntro — Section 1's living intro.
 *
 * The prompt ("Find Your Next Tournament") sits directly above its payoff (the
 * Recent Events grid). The centerpiece is a real search entry that submits
 * directly to /events?q=<term> — the same URL the Find Events page reads, so
 * the typed query lands pre-populated in the search box on arrival. Popular
 * chips do the same thing with their term.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POPULAR = ["U14 Boys", "St. Louis, MO", "This summer"];

/* Popular chips — same red "string" trace-on-hover as the landing page hero
   search (see HeroSearch.tsx). Scoped locally since this component never
   renders alongside HeroSearch, so the @property registration can't clash. */
const POP_CHIP_CSS = `
@property --hero-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
.hero-pop { position: relative; transition: background .2s ease, color .2s ease; }
.hero-pop::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px;
  background: conic-gradient(from var(--hero-angle), rgba(220,38,38,0) 0deg 248deg, var(--color-accent) 300deg, rgba(220,38,38,0) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  opacity: 0; transition: opacity .2s ease; pointer-events: none;
}
.hero-pop:hover, .hero-pop:focus-visible { background: #fff; color: var(--color-dark); }
.hero-pop:hover::before, .hero-pop:focus-visible::before {
  opacity: 1; animation: hero-trace 1.4s linear infinite;
}
.hero-pop:hover .hero-pop-ico, .hero-pop:focus-visible .hero-pop-ico { opacity: .85 !important; }
@keyframes hero-trace { to { --hero-angle: 360deg; } }
@media (prefers-reduced-motion: reduce) {
  .hero-pop::before { transition: none; }
  .hero-pop:hover::before, .hero-pop:focus-visible::before {
    animation: none; background: var(--color-accent);
  }
}
`;

/* Hand-drawn marker underline — brand red, matches the landing page motif. */
function Swipe({ children }: { children: React.ReactNode }) {
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
          fill="rgba(220,38,38,.20)"
        />
      </svg>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

export function FindTournamentIntro() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function go(term: string) {
    const trimmed = term.trim();
    router.push(trimmed ? `/events?q=${encodeURIComponent(trimmed)}` : "/events");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    go(query);
  }

  return (
    <>
      <style>{POP_CHIP_CSS}</style>
      <div
        className="relative overflow-hidden rounded-[28px]"
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, #fff7f7 62%, #fef2f2 100%)",
          border: "1px solid rgba(220,38,38,.16)",
          boxShadow:
            "0 24px 60px -30px rgba(220,38,38,.35), 0 1px 2px rgba(15,23,42,.04)",
        }}
      >
        {/* soft brand orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: -90,
            right: -60,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,38,38,.12), transparent 68%)",
          }}
        />
        <div
          className="relative flex flex-col gap-7"
          style={{ padding: "clamp(28px, 4vw, 48px)" }}
        >
          {/* Copy side */}
          <div className="min-w-0">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span
                className="shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: "var(--color-accent)" }}
                aria-hidden="true"
              />
              <span
                className="font-heading uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--color-accent)",
                  letterSpacing: ".14em",
                }}
              >
                Tournament Search
              </span>
            </div>

            <h2
              className="font-heading text-dark"
              style={{
                fontSize: "clamp(22px, 2.6vw, 30px)",
                fontWeight: 800,
                letterSpacing: "-0.028em",
                lineHeight: 1.12,
                margin: 0,
                textWrap: "balance",
              }}
            >
              Find Your Next <Swipe>Tournament</Swipe>
            </h2>

            <p
              className="mt-4 mb-0"
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
              }}
            >
              Welcome to Soccer Tournament Reviews, your one-stop shop to find
              the best soccer tournaments for your team. Whether you&rsquo;re
              looking for local youth tournaments or international competitions,
              we&rsquo;ve got you covered. Our comprehensive reviews and
              detailed ratings will help you choose the perfect tournament for
              your squad. Join us in the exciting world of soccer tournaments
              and take your team to new heights.
            </p>
          </div>

          {/* Interactive search side */}
          <div className="min-w-0">
            <div
              className="rounded-[22px] bg-white"
              style={{
                padding: "16px 16px 14px",
                boxShadow:
                  "0 18px 44px -22px rgba(15,23,42,.4), 0 0 0 1px rgba(15,23,42,.04)",
              }}
            >
              <form onSubmit={handleSubmit}>
                <label htmlFor="attendees-search" className="sr-only">
                  Search tournaments
                </label>
                <div
                  className="group flex w-full items-center gap-3 rounded-full border border-[var(--color-border)] bg-[#f8fafc] transition-all duration-200 hover:border-[var(--color-text-faint)] hover:shadow-[0_2px_8px_rgba(15,23,42,.08)] focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_rgba(220,38,38,.1)]"
                  style={{ padding: "6px 6px 6px 16px" }}
                >
                  <svg
                    className="shrink-0 text-[#94a3b8] transition-all duration-200 group-hover:translate-x-0.5 group-hover:scale-110 group-focus-within:translate-x-0.5 group-focus-within:text-[var(--color-accent)]"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    id="attendees-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by keyword"
                    className="w-full bg-transparent py-3 pr-2 text-[15px] text-dark placeholder-gray-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="font-heading shrink-0 cursor-pointer rounded-full px-5 py-2.5 text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      background:
                        "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
                      boxShadow: "0 8px 20px -6px rgba(220,38,38,.5)",
                    }}
                  >
                    Search
                  </button>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-2 pl-1">
                <span
                  className="font-heading uppercase"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: ".12em",
                    color: "var(--color-text-faint)",
                  }}
                >
                  Popular
                </span>
                {POPULAR.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => go(q)}
                    className="hero-pop inline-flex cursor-pointer items-center gap-1.5 rounded-full border"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: "5px 13px",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-secondary)",
                      background: "var(--color-surface-alt)",
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="hero-pop-ico"
                      style={{ opacity: 0.55 }}
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <Link
              href="/events"
              className="font-heading mt-3.5 ml-1 inline-flex cursor-pointer items-center gap-1.5 bg-transparent no-underline hover:underline"
              style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-accent)" }}
            >
              Browse all events
              <svg
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
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
