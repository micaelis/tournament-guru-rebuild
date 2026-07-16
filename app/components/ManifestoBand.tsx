/* ManifestoBand — the page's one dark tonal beat. Merges the mission statement
   with the real stats, rendered large. Kept in the prototype's design family:
   the same aurora glow + grain language as the SponsoredBanner and page bg,
   just quieter. */

type StatsData = {
  eventsCount: number;
  reviewsCount: number;
  tournamentsCount: number;
};

const STATS = [
  { key: "reviews" as const, label: "Verified reviews" },
  { key: "events" as const, label: "Events listed" },
  { key: "tournaments" as const, label: "Tournaments listed" },
];

/* Marker underline — a red band drawn with a background gradient (cloned across
   line breaks) rather than an inline-block, so the phrase wraps as normal text
   instead of shrink-wrapping to its own content. */
function Underline({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        backgroundImage:
          "linear-gradient(transparent 60%, rgba(220,38,38,.44) 60%, rgba(220,38,38,.44) 94%, transparent 94%)",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        padding: "0 1px",
      }}
    >
      {children}
    </span>
  );
}

/* A single confident felt-tip swipe beneath each stat — a FILLED marker
   stroke (thick through the middle, tapered to points at both ends) rather
   than a drawn line, in brand red so the numbers feel alive. Two path
   variants keep the three from looking stamped. */
const MARK_PATHS = [
  "M5,9 C36,6.4 80,6 115,7.2 C82,10.6 38,11.2 5,9 Z",
  "M5,7.4 C38,10.4 82,10.8 115,8.2 C80,5.4 38,5 5,7.4 Z",
];
function StatMark({ i }: { i: number }) {
  return (
    <svg
      viewBox="0 0 120 16"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        display: "block",
        width: 54,
        height: 10,
        margin: "10px auto 0",
      }}
    >
      <path d={MARK_PATHS[i % MARK_PATHS.length]} fill="rgba(220,38,38,.62)" />
    </svg>
  );
}

/* Inline emphasis for the copy's key phrases — a soft red highlighter swiped
   under the words (cloned across line wraps), tying them to the brand accent
   instead of the shouty all-caps of the source text. */
function Em({ children }: { children: React.ReactNode }) {
  return (
    <em
      style={{
        fontStyle: "normal",
        fontWeight: 600,
        color: "#fff",
        background:
          "linear-gradient(transparent 56%, rgba(220,38,38,.36) 56%, rgba(220,38,38,.36) 90%, transparent 90%)",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        padding: "0 2px",
        borderRadius: 2,
      }}
    >
      {children}
    </em>
  );
}

export function ManifestoBand({ stats }: { stats: StatsData }) {
  const values: Record<string, number> = {
    reviews: stats.reviewsCount,
    events: stats.eventsCount,
    tournaments: stats.tournamentsCount,
  };

  // A big "0" undercuts a trust band — only show stats with real counts.
  const visibleStats = STATS.filter((s) => values[s.key] > 0);

  return (
    <section
      className="relative isolate overflow-hidden"
      style={{ background: "#0b1120" }}
    >
      {/* Aurora glow — same family as the page bg / sponsored banner, quieter */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(780px 480px at 8% -16%, rgba(220,38,38,.24) 0%, rgba(220,38,38,.08) 42%, transparent 74%)," +
            "radial-gradient(720px 460px at 100% 120%, rgba(37,99,235,.16), transparent 62%)",
        }}
      />

      {/* Mission photo — revealed inside a soft circle centred on the section's
         top-right corner: the image shows only within the circle and dissolves
         into the dark on a curved edge, so there's no straight seam anywhere. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden md:block"
        style={{ width: "72%" }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "url('/fancy-crave-qowyMze7jqg-unsplash.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            // Large circular reveal centred on the top-right corner: the image
            // fills as much as possible, then dissolves into the dark on a long,
            // soft curved edge so its "start" is never a visible line.
            WebkitMaskImage:
              "radial-gradient(115% 122% at 100% 0%, #000 0%, #000 42%, rgba(0,0,0,.45) 64%, transparent 84%)",
            maskImage:
              "radial-gradient(115% 122% at 100% 0%, #000 0%, #000 42%, rgba(0,0,0,.45) 64%, transparent 84%)",
          }}
        />
        {/* Tint: a radial from the SAME top-right corner as the reveal, so the
           bright sky mutes together with the reveal (no straight edge) + a
           gentle left-to-right veil that starts transparent so it never clips
           the aurora at the image layer's left edge. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(96% 64% at 100% 0%, rgba(11,17,32,.6) 0%, rgba(11,17,32,.26) 34%, transparent 66%)," +
              "linear-gradient(to right, transparent 0%, rgba(11,17,32,.34) 26%, rgba(11,17,32,.12) 100%)",
          }}
        />
      </div>

      {/* Grain */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        style={{ opacity: 0.08, mixBlendMode: "overlay" }}
      >
        <filter id="manifesto-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            stitchTiles="stitch"
          />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .65 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#manifesto-grain)" />
      </svg>

      <div className="relative z-[2] mx-auto max-w-[1120px] px-6 py-14 md:py-20">
        <div className="w-full">
          {/* Eyebrow chip */}
          <div className="flex justify-center">
            <span
              className="inline-flex items-center gap-2.5 rounded-full"
              style={{
                padding: "9px 18px 9px 14px",
                background: "rgba(220,38,38,.13)",
                border: "1px solid rgba(220,38,38,.36)",
                boxShadow:
                  "0 12px 32px -12px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.10)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              <span
                className="rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  background: "var(--color-accent)",
                  boxShadow: "0 0 12px rgba(220,38,38,1)",
                }}
                aria-hidden="true"
              />
              <span
                className="font-heading uppercase"
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: ".17em",
                  color: "rgba(255,255,255,.96)",
                }}
              >
                Who We Are &amp; What We Do
              </span>
            </span>
          </div>

          {/* Two heroes in one 2×2 grid, equal columns. Column 2 is flipped —
             subtext (glass) on top, its title below — so the two titles land on
             a diagonal (never side-by-side to compare line counts) and every row
             edge is a straight line across both columns. Order utilities keep the
             mobile stack natural: title → card, per hero. */}
          <div className="relative mt-12 grid grid-cols-1 items-stretch gap-x-16 gap-y-6 md:grid-cols-2 md:gap-x-24">
            {/* Vertical divider so each hero reads as its own standalone block */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-2 left-1/2 hidden w-px -translate-x-1/2 md:block"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, rgba(255,255,255,.12) 16%, rgba(255,255,255,.12) 84%, transparent)",
              }}
            />
            {/* Hero 1 title — mission (top-left) */}
            <h2
              className="order-1 self-center font-heading text-white md:order-1"
              style={{
                fontSize: "clamp(21px, 2.3vw, 30px)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                textShadow: "0 2px 24px rgba(11,17,32,.5)",
              }}
            >
              Our goal is to make the often difficult, daunting tournament
              selection process{" "}
              <Underline>easier and more transparent</Underline> for all teams.
            </h2>
            {/* Hero 1 card — solid red (bottom-left) */}
            <div
              className="order-2 flex items-center md:order-3"
              style={{
                fontSize: 15.5,
                lineHeight: 1.6,
                fontWeight: 500,
                color: "#fff",
                padding: "30px 32px",
                background: "var(--color-accent)",
                borderRadius: 20,
                boxShadow:
                  "0 28px 54px -22px rgba(220,38,38,.55), 0 12px 30px -18px rgba(0,0,0,.7)",
              }}
            >
              Our staff is made up of career event directors, coaches, and
              parents who have decades of experience running and attending
              tournaments.
            </div>
            {/* Hero 2 title — what we do (bottom-right) */}
            <h3
              className="order-3 self-center font-heading text-white md:order-4"
              style={{
                fontSize: "clamp(21px, 2.3vw, 30px)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                textShadow: "0 2px 24px rgba(11,17,32,.5)",
              }}
            >
              Search by the criteria that matter to you — then decide with{" "}
              <Underline>real reviews</Underline>.
            </h3>
            {/* Hero 2 card — glass, softer blur (top-right) */}
            <div
              className="order-4 flex items-center md:order-2"
              style={{
                fontSize: 15.5,
                lineHeight: 1.62,
                color: "rgba(226,232,240,.88)",
                padding: "30px 32px",
                background: "rgba(15,23,42,.55)",
                border: "1px solid rgba(255,255,255,.09)",
                borderRadius: 20,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                boxShadow: "0 24px 48px -30px rgba(0,0,0,.75)",
              }}
            >
              <span>
                <Em>Event attendees</Em> filter for what matters to their team,
                then lean on <Em>crowd-sourced reviews and ratings</Em> from
                people who were actually there — and add their own once the event
                wraps.
              </span>
            </div>
          </div>

          {/* Trust bar */}
          <div
            className="mx-auto mt-12 grid max-w-[760px] grid-cols-1 gap-6"
            style={{
              borderTop: "1px solid rgba(255,255,255,.1)",
              paddingTop: 32,
              gridTemplateColumns:
                visibleStats.length > 1
                  ? `repeat(${visibleStats.length}, minmax(0, 1fr))`
                  : undefined,
            }}
          >
            {visibleStats.map((s, i) => (
              <div key={s.key} className="text-center">
                <div
                  className="font-heading"
                  style={{
                    fontSize: "clamp(34px, 4.6vw, 50px)",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    color: "#fff",
                  }}
                >
                  {values[s.key].toLocaleString()}
                </div>
                <StatMark i={i} />
                <div
                  className="mt-2 uppercase"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".08em",
                    color: "rgba(148,163,184,.9)",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
