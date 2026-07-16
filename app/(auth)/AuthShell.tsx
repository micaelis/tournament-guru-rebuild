import type { ReactNode } from "react";
import Image from "next/image";
import { Header } from "@/app/components/Header";
import { createServerAuthClient } from "@/lib/supabase/server";
import { fetchPlatformStats } from "@/app/(site)/queries";

/**
 * Shared two-column shell for every auth + onboarding surface (login,
 * signup, reset, reset/update, onboarding, and the promo placeholder).
 * Form/inputs live on the left over the same aurora backdrop the landing
 * page uses; a sticky, full-height photo with a glass welcome panel sits
 * on the right. The site Header rides on top with its "Sign in" CTA
 * suppressed (redundant while inside the auth flow) — a signed-in user
 * still gets the avatar + Log out control, which doubles as the
 * onboarding logout affordance.
 *
 * Presentation only: it renders whatever form the page hands it as
 * `children` and never touches auth logic. The `variant` prop only swaps
 * the right-panel copy.
 */
type Variant = "default" | "ed-claim";

const PANELS: Record<
  Variant,
  { eyebrow: string; title: string; body: ReactNode; chips: string[] }
> = {
  default: {
    eyebrow: "The most comprehensive youth sports tournament search engine",
    title: "Welcome to Tournament Guru",
    body: (
      <>
        Your one-stop shop to find the right event for{" "}
        <b style={{ color: "#fff", fontWeight: 800 }}>YOUR</b> team — chosen
        with reviews from people who actually went.
      </>
    ),
    chips: ["Coaches", "Team Managers", "Parents", "Event Directors"],
  },
  "ed-claim": {
    eyebrow: "For Event Directors",
    title: "Become Part of the Largest and Growing Soccer Community",
    body: "Tournament Guru lists all publicly available tournament listings from around the United States. Claiming your event allows Event Directors to maximize their visibility by customizing the information available to the thousands of tournament seekers.",
    chips: ["Coaches", "Team Managers", "Parents", "Event Directors"],
  },
};

/* Same aurora the landing page paints behind its sections (site/page.tsx):
   red / blue / gold / violet radial washes, viewport-fixed so the auth
   form scrolls over a steady backdrop. */
const AURORA: React.CSSProperties = {
  backgroundColor: "#eef2f9",
  backgroundImage:
    "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.13), transparent 56%)," +
    "radial-gradient(980px 600px at 104% -8%, rgba(0,77,255,.10), transparent 56%)," +
    "radial-gradient(820px 820px at 100% 50%, rgba(245,158,11,.07), transparent 60%)," +
    "radial-gradient(1000px 900px at 40% 126%, rgba(124,58,237,.07), transparent 60%)",
  backgroundAttachment: "fixed",
  backgroundRepeat: "no-repeat",
};

type Metric = {
  key: string;
  value: number;
  label: string;
  icon: ReactNode;
  color: string;
  filled?: boolean;
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

export default async function AuthShell({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  const panel = PANELS[variant];

  // Both reads are cheap and best-effort; a signed-out visitor simply
  // gets a null email (header hides its control) and the stat rail hides
  // any zero counters, so neither call can break the auth screens.
  const supabase = await createServerAuthClient();
  const [{ data: userData }, stats] = await Promise.all([
    supabase.auth.getUser(),
    fetchPlatformStats(),
  ]);

  const metrics: Metric[] = (
    [
      { key: "reviews", value: stats.reviews, label: "verified reviews", icon: ICON_STAR, color: "var(--color-gold-bright)", filled: true },
      { key: "events", value: stats.events, label: "events listed", icon: ICON_CALENDAR, color: "#8ab0ff" },
      { key: "tournaments", value: stats.tournaments, label: "tournaments listed", icon: ICON_TROPHY, color: "#f87171" },
    ] as Metric[]
  ).filter((m) => m.value > 0);

  return (
    <div className="flex min-h-dvh flex-col" style={AURORA}>
      <Header initialEmail={userData.user?.email ?? null} hideSignInCta />

      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 md:grid-cols-[minmax(380px,560px)_1fr]">
        {/* ── Left: form column ── */}
        <div className="flex flex-col px-6 py-10 md:px-14 md:py-14">
          <div className="flex flex-1 items-center">
            <div className="w-full">{children}</div>
          </div>
          <p className="mt-10 text-xs text-slate-400">
            © {new Date().getFullYear()} Tournament Guru
          </p>
        </div>

        {/* ── Right: sticky photo + glass welcome panel ── */}
        <aside className="relative hidden md:block">
          <div className="sticky top-[72px] h-[calc(100dvh-72px)] overflow-hidden p-4">
            <div className="relative h-full w-full overflow-hidden rounded-3xl">
              <Image
                src="/hero3.webp"
                alt="Youth soccer on a sunlit pitch"
                fill
                priority
                sizes="(max-width: 768px) 0px, 50vw"
                className="object-cover"
                style={{ objectPosition: "50% 42%" }}
              />
              {/* Calm, cool slate overlay — no warm glow, so the welcome
                 copy stays legible without competing with the aurora. */}
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(15,23,42,.40) 0%, rgba(15,23,42,.60) 52%, rgba(15,23,42,.86) 100%)," +
                    "linear-gradient(105deg, rgba(15,23,42,.55) 0%, rgba(15,23,42,.10) 46%, rgba(15,23,42,0) 72%)",
                }}
              />

              <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-11">
                <div
                  className="max-w-[460px] rounded-[22px] p-7 lg:p-8"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,.05) 100%)",
                    border: "1px solid rgba(255,255,255,.18)",
                    backdropFilter: "blur(18px) saturate(115%)",
                    WebkitBackdropFilter: "blur(18px) saturate(115%)",
                    boxShadow:
                      "0 30px 60px -30px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)",
                  }}
                >
                  {/* Eyebrow — the landing's "most comprehensive…" badge language */}
                  <span
                    className="font-heading inline-flex rounded-full uppercase"
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: ".12em",
                      lineHeight: 1.25,
                      color: "rgba(255,255,255,.95)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.06) 100%)",
                      border: "1px solid rgba(255,255,255,.24)",
                      padding: "6px 12px",
                    }}
                  >
                    {panel.eyebrow}
                  </span>

                  <h2
                    className="font-heading mt-4 text-white"
                    style={{
                      fontSize: variant === "ed-claim" ? 28 : 34,
                      fontWeight: 800,
                      lineHeight: 1.06,
                      letterSpacing: "-0.02em",
                      textWrap: "balance",
                    }}
                  >
                    {panel.title}
                  </h2>

                  <p
                    className="mt-4"
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      color: "rgba(255,255,255,.82)",
                    }}
                  >
                    {panel.body}
                  </p>

                  {/* Audience chips — frosted, matching the hero's glass chip language */}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {panel.chips.map((chip) => (
                      <span
                        key={chip}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#fff",
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.05) 100%)",
                          border: "1px solid rgba(255,255,255,.22)",
                          borderRadius: 999,
                          padding: "6px 13px",
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  {/* Metric rail — real platform counters, icon + tone per
                     stat, hairline dividers: the landing's trust-bar language. */}
                  {metrics.length > 0 && (
                    <div
                      className="mt-7 flex overflow-hidden rounded-2xl"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.04) 100%)",
                        border: "1px solid rgba(255,255,255,.16)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
                      }}
                    >
                      {metrics.map((m, i) => (
                        <div
                          key={m.key}
                          className="flex flex-1 flex-col items-center justify-center text-center"
                          style={{
                            padding: "12px 8px",
                            borderLeft:
                              i > 0
                                ? "1px solid rgba(255,255,255,.14)"
                                : undefined,
                          }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <svg
                              width="14"
                              height="14"
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
                              style={{
                                fontSize: 18,
                                fontWeight: 800,
                                letterSpacing: "-0.02em",
                              }}
                            >
                              {m.value.toLocaleString()}
                            </b>
                          </span>
                          <span
                            style={{
                              marginTop: 3,
                              fontSize: 10.5,
                              color: "rgba(255,255,255,.68)",
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
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
