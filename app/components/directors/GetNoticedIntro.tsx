import Link from "next/link";

/*
 * GetNoticedIntro — Section 1 of the /host hub.
 *
 * Mirrors the visual language of FindTournamentIntro (light red-tinted card
 * with a warm gradient orb) but the CTA is a hard Link into the auth flow.
 * The `?panel=director` param flips AuthPanel to show the "Become Part of
 * the Largest and Growing Soccer Community" marketing copy; `next=/host`
 * bounces the user back after signing in.
 */
export function GetNoticedIntro() {
  return (
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
        className="relative flex flex-col gap-6"
        style={{ padding: "clamp(28px, 4vw, 48px)" }}
      >
        {/* Eyebrow pill — screenshot's "Get Noticed" tag */}
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
          Get Noticed
        </span>

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
          Claim Your Event Listing Or Create One For Free
        </h2>

        <p
          className="mb-0"
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Tournament Guru brings all publicly available tournament listings
          from around the United States into one, easy to navigate site view by
          thousands of coaches, team managers, and attendees. Claiming your
          event allows Event Directors to maximize their visibility, grow their
          brand, and reach their target audience by customizing the information
          displayed.
        </p>

        <Link
          href="/signup?type=event_director"
          className="font-heading inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full px-7 py-3 text-white no-underline transition-all duration-200 hover:-translate-y-0.5"
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            background:
              "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
            boxShadow: "0 12px 28px -8px rgba(220,38,38,.6)",
          }}
        >
          Claim / Create Free Listing
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
  );
}
