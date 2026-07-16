/*
 * GetGrowingIntro — Section 2 of the /host hub.
 *
 * The "Upgrade Your Event Listing" pair to GetNoticedIntro. Uses the dark
 * navy card treatment from ShareExperienceIntro so the two hub cards read
 * as visually distinct paths (light red = free / dark navy = paid) — same
 * pattern the /attendees hub uses to differentiate "search" from "review".
 */
export function GetGrowingIntro() {
  return (
    <div
      className="relative overflow-hidden rounded-[28px]"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
        boxShadow: "0 28px 70px -34px rgba(15,23,42,.7)",
      }}
    >
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
        className="relative flex flex-col gap-6"
        style={{ padding: "clamp(28px, 4vw, 48px)" }}
      >
        <span
          className="font-heading self-start"
          style={{
            display: "inline-block",
            padding: "7px 16px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 800,
            letterSpacing: ".04em",
            color: "#fff",
            background: "linear-gradient(135deg, #fb923c, var(--color-accent))",
            boxShadow: "0 8px 20px -6px rgba(220,38,38,.45)",
          }}
        >
          Get Growing
        </span>

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
          Upgrade Your Event Listing And Advertise
        </h2>

        <p
          className="mb-0"
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "rgba(255,255,255,.75)",
            margin: 0,
          }}
        >
          With over 2,000 annual tournaments nationwide it can be hard to stand
          out. Our event listing upgrades ensure that your events are reaching
          your target audience and showing what makes your events stand out
          among the crowd. Upgrading your event listing is fast, easy, and
          inexpensive. Plans and packages available to meet your needs and
          budget.
        </p>

        {/* Upgrade options aren't live yet — presenting a branded
            Coming-Soon chip in place of the CTA so the section still
            feels intentional rather than orphaned. */}
        <div
          className="font-heading inline-flex items-center gap-2.5 self-start rounded-full"
          role="status"
          aria-label="Upgrade options coming soon"
          style={{
            padding: "10px 18px 10px 14px",
            fontSize: 13.5,
            fontWeight: 800,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.96)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 100%)",
            border: "1px solid rgba(255,255,255,.28)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow:
              "0 6px 18px -8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.22)",
          }}
        >
          <span
            aria-hidden="true"
            className="relative inline-flex"
            style={{ width: 8, height: 8 }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--color-accent)",
                boxShadow: "0 0 10px rgba(220,38,38,.9)",
              }}
            />
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--color-accent)",
                animation: "tg-cs-pulse 1.8s ease-out infinite",
                opacity: 0.55,
              }}
            />
          </span>
          Coming Soon
        </div>
        <style>{`
          @keyframes tg-cs-pulse {
            0% { transform: scale(1); opacity: .55; }
            80% { transform: scale(2.4); opacity: 0; }
            100% { transform: scale(2.4); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes tg-cs-pulse { to { opacity: .55; transform: none; } }
          }
        `}</style>
      </div>
    </div>
  );
}
