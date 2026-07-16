import type { ReactNode } from "react";
import Image from "next/image";
import { Header } from "@/app/components/Header";
import { TGLogo } from "@/app/components/TGLogo";
import { HighlightSwipe } from "@/app/components/HighlightSwipe";
import { fetchPlatformStats } from "@/app/(site)/queries";

/**
 * Shared shell for every auth + onboarding surface (login, signup, reset,
 * reset/update, onboarding, and the promo placeholder).
 *
 * Layout: the site Header rides on top in `authMode` (logo dropped, nav
 * left-aligned, "Browse events" CTA). The brand logo lives at the top of the
 * left content column, above the form (`children`). A dusk-lit stadium photo
 * is anchored to the right edge of the viewport with an even 20px margin; the
 * welcome copy floats on it as an editorial hero — frosted badge, headline
 * with the brand highlight-swipe, tagline, audience chips, and a real-stats
 * metric bar.
 *
 * Presentation only: it renders whatever form the page hands it as `children`
 * and never touches auth logic. `variant` only swaps the right-panel copy.
 */
type Variant = "default" | "ed-claim";

const PANELS: Record<
  Variant,
  { badge: string; headline: ReactNode; lead: ReactNode; chips: string[] }
> = {
  default: {
    badge: "The most comprehensive youth sports tournament search engine",
    headline: (
      <>
        Welcome to
        <br />
        <HighlightSwipe color="rgba(220,38,38,.5)">
          Tournament Guru
        </HighlightSwipe>
      </>
    ),
    lead: (
      <>
        Your one-stop shop to find the right event for{" "}
        <b style={{ color: "#fff", fontWeight: 800 }}>YOUR</b> team — chosen with
        reviews from people who actually went.
      </>
    ),
    chips: ["Coaches", "Team Managers", "Parents", "Event Directors"],
  },
  "ed-claim": {
    badge: "For Event Directors",
    headline: <>Become Part of the Largest &amp; Growing Soccer Community</>,
    lead: "Tournament Guru lists all publicly available tournament listings from around the United States. Claiming your event allows Event Directors to maximize their visibility by customizing the information available to the thousands of tournament seekers.",
    chips: ["Coaches", "Team Managers", "Parents", "Event Directors"],
  },
};

const ICON_STAR = (
  <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
);
const ICON_CALENDAR = (
  <>
    <rect x="3" y="4" width="18" height="17" rx="2.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </>
);
const ICON_TROPHY = (
  <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M6 4h12v5a6 6 0 01-12 0V4zM12 15v4M8 21h8" />
);

type Metric = {
  key: string;
  value: number;
  label: string;
  icon: ReactNode;
  color: string;
  filled?: boolean;
};

export default async function AuthShell({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  const panel = PANELS[variant];

  // Cheap counters, best-effort: any zero counter is hidden and a failed read
  // returns zeros, so the stat bar can never break the auth screens.
  const stats = await fetchPlatformStats();
  const metrics: Metric[] = (
    [
      { key: "reviews", value: stats.reviews, label: "verified reviews", icon: ICON_STAR, color: "var(--color-gold-bright)", filled: true },
      { key: "events", value: stats.events, label: "events listed", icon: ICON_CALENDAR, color: "#8ab0ff" },
      { key: "tournaments", value: stats.tournaments, label: "tournaments listed", icon: ICON_TROPHY, color: "#f87171" },
    ] as Metric[]
  ).filter((m) => m.value > 0);

  return (
    <div
      className="relative flex min-h-dvh flex-col"
      style={{
        // Same aurora the landing page paints behind its sections.
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
      <Header authMode />

      <div className="flex flex-1">
        {/* ── Left: logo + form ── */}
        <section className="flex w-full flex-col px-6 pt-6 pb-8 md:w-1/2 md:px-14">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full" style={{ maxWidth: 396 }}>
              <div style={{ marginBottom: 24 }}>
                <TGLogo href="/" size="xl" />
              </div>
              {children}
              <p
                className="mt-4 flex items-center justify-center gap-1.5"
                style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)" }}
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
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Your details stay private — we never share them.
              </p>
            </div>
          </div>
          <p className="mt-6 text-xs" style={{ color: "var(--color-text-muted)" }}>
            © {new Date().getFullYear()} Tournament Guru
          </p>
        </section>

        {/* ── Right: dusk photo anchored to the edge + floating hero ── */}
        <aside
          className="hidden md:block"
          style={{
            position: "fixed",
            top: 85,
            right: 20,
            bottom: 20,
            left: "50%",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <Image
            src="/fancy-crave-qowyMze7jqg-unsplash.webp"
            alt="Youth soccer tournament under stadium lights at dusk"
            fill
            priority
            sizes="50vw"
            style={{ objectFit: "cover", objectPosition: "50% 46%" }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(15,23,42,.10) 0%, rgba(15,23,42,.26) 34%, rgba(10,14,22,.66) 68%, rgba(7,10,17,.9) 100%)," +
                "radial-gradient(120% 78% at 28% 116%, rgba(6,9,16,.66), transparent 62%)",
            }}
          />

          <div
            className="absolute inset-0 flex flex-col justify-end"
            style={{ padding: 44 }}
          >
            <div style={{ maxWidth: 560, width: "100%" }}>
              {/* Badge chip — legible over any part of the photo */}
              <div
                className="inline-flex items-center"
                style={{
                  gap: 9,
                  marginBottom: 22,
                  padding: "8px 14px",
                  borderRadius: 12,
                  background:
                    "linear-gradient(180deg, rgba(15,23,42,.5), rgba(15,23,42,.64))",
                  border: "1px solid rgba(255,255,255,.22)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow: "0 8px 22px -10px rgba(0,0,0,.6)",
                }}
              >
                <span
                  style={{
                    flex: "none",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--color-accent)",
                    boxShadow: "0 0 9px rgba(220,38,38,.9)",
                  }}
                />
                <span
                  className="font-heading uppercase"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: ".12em",
                    lineHeight: 1.4,
                    color: "#fff",
                  }}
                >
                  {panel.badge}
                </span>
              </div>

              <h2
                className="font-heading"
                style={{
                  fontWeight: 800,
                  fontSize: 50,
                  lineHeight: 1.0,
                  letterSpacing: "-.035em",
                  margin: 0,
                  color: "#fff",
                  textShadow: "0 2px 20px rgba(0,0,0,.35)",
                }}
              >
                {panel.headline}
              </h2>

              <p
                style={{
                  margin: "22px 0 0",
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.9)",
                  maxWidth: 490,
                  fontWeight: 500,
                  textShadow: "0 1px 12px rgba(0,0,0,.4)",
                }}
              >
                {panel.lead}
              </p>

              <div className="flex flex-wrap" style={{ gap: 8, marginTop: 24 }}>
                {panel.chips.map((chip) => (
                  <span
                    key={chip}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#fff",
                      borderRadius: 999,
                      padding: "5px 12px",
                      background: "rgba(255,255,255,.1)",
                      border: "1px solid rgba(255,255,255,.26)",
                      backdropFilter: "blur(6px)",
                      WebkitBackdropFilter: "blur(6px)",
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>

              {/* Metric bar — real counters, dark glass so the numbers pop.
                 Shown only when ≥2 have data; a lone stat looks unfinished. */}
              {metrics.length >= 2 && (
                <div
                  className="flex overflow-hidden"
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    borderRadius: 18,
                    marginTop: 26,
                    background:
                      "linear-gradient(180deg, rgba(15,23,42,.34), rgba(15,23,42,.46))",
                    border: "1px solid rgba(255,255,255,.2)",
                    backdropFilter: "blur(14px) saturate(120%)",
                    WebkitBackdropFilter: "blur(14px) saturate(120%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,.18), 0 18px 40px -18px rgba(0,0,0,.75)",
                  }}
                >
                  {metrics.map((m, i) => (
                    <div
                      key={m.key}
                      className="flex flex-1 flex-col items-center justify-center text-center"
                      style={{
                        padding: "19px 10px",
                        borderLeft: i > 0 ? "1px solid rgba(255,255,255,.16)" : undefined,
                      }}
                    >
                      <span className="inline-flex items-center" style={{ gap: 8 }}>
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill={m.filled ? m.color : "none"}
                          stroke={m.color}
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          {m.icon}
                        </svg>
                        <b
                          className="font-heading text-white"
                          style={{ fontSize: 31, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1 }}
                        >
                          {m.value.toLocaleString()}
                        </b>
                      </span>
                      <span
                        style={{
                          marginTop: 7,
                          fontSize: 12,
                          fontWeight: 500,
                          color: "rgba(255,255,255,.82)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
