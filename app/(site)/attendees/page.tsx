import { Suspense } from "react";
import Link from "next/link";
import { FeaturedShowcase } from "@/app/components/FeaturedShowcase";
import { ReviewShowcase } from "@/app/components/ReviewShowcase";
import { FindTournamentIntro } from "@/app/components/attendees/FindTournamentIntro";
import { ShareExperienceIntro } from "@/app/components/attendees/ShareExperienceIntro";
import { SectionEyebrow } from "@/app/components/SectionEyebrow";
import {
  getFeaturedEvents,
  type ReviewRow,
} from "@/lib/supabase/queries";
import { DEMO_RECENT_REVIEWS } from "@/lib/data/demo-recent-reviews";

export const metadata = { title: "For Attendees · Tournament Guru" };

export const dynamic = "force-dynamic";

export default async function AttendeesPage() {
  return (
    <div
      style={{
        backgroundColor: "#eef2f9",
        backgroundImage:
          "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.12), transparent 56%)," +
          "radial-gradient(900px 620px at 104% -8%, rgba(15,23,42,.06), transparent 58%)," +
          "radial-gradient(800px 640px at 100% 50%, rgba(220,38,38,.06), transparent 55%)," +
          "radial-gradient(700px 500px at 40% 126%, rgba(15,23,42,.04), transparent 60%)",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Page identity strip — branded pill, echoes the landing hero's
          frosted chip but adapted to a light aurora background: white
          card with a pulsing red brand dot + uppercase kicker. */}
      <section className="mx-auto max-w-[1180px] px-10 pt-14 pb-4 text-center">
        <div className="mb-4 flex justify-center">
          <div
            className="font-heading inline-flex items-center gap-2.5 rounded-full"
            style={{
              padding: "9px 18px 9px 14px",
              background:
                "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid rgba(15,23,42,.08)",
              boxShadow:
                "0 2px 6px -1px rgba(15,23,42,.08), 0 8px 22px -14px rgba(15,23,42,.18), inset 0 1px 0 rgba(255,255,255,.9)",
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
                  boxShadow: "0 0 8px rgba(220,38,38,.8)",
                }}
              />
              <span
                className="absolute inset-0 rounded-full tg-attendees-pulse"
                style={{
                  background: "var(--color-accent)",
                }}
              />
            </span>
            <span
              className="uppercase"
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                letterSpacing: ".18em",
                color: "var(--color-dark)",
                lineHeight: 1,
              }}
            >
              For Attendees
            </span>
          </div>
          <style>{`
            .tg-attendees-pulse { animation: tg-attendees-pulse 1.8s ease-out infinite; opacity: .5; }
            @keyframes tg-attendees-pulse {
              0%   { transform: scale(1);   opacity: .5; }
              80%  { transform: scale(2.6); opacity: 0; }
              100% { transform: scale(2.6); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .tg-attendees-pulse { animation: none; opacity: .5; }
            }
          `}</style>
        </div>
        <h1
          className="font-heading text-dark"
          style={{
            fontSize: "clamp(26px, 3.4vw, 38px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            margin: 0,
            textWrap: "balance",
          }}
        >
          Everything you need for the weekend
        </h1>
        <p
          className="mx-auto mt-3 mb-0"
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
            maxWidth: 560,
          }}
        >
          Find the right tournament for your team — then help the next family
          decide by sharing how yours went.
        </p>
      </section>

      {/* ─── Hub — two paths ─── */}
      <section className="mx-auto max-w-[1440px] px-10 pt-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FindTournamentIntro />
          <ShareExperienceIntro />
        </div>
      </section>

      {/* ─── Featured Events ─── */}
      <section className="mx-auto max-w-[1180px] px-10 pt-24">
        <SectionHeader
          eyebrow="Featured Events"
          title="Tournaments in the spotlight"
          subtitle="Premium-listed events hand-picked for visibility — tap any card for the full breakdown."
        />
        <div className="mt-7">
          <Suspense fallback={<FeaturedSkeleton />}>
            <FeaturedEventsSection />
          </Suspense>
        </div>
        <div className="mt-5 flex justify-center">
          <Link
            href="/events"
            className="font-heading inline-flex items-center gap-1.5 rounded-full border bg-white px-5 py-2.5 text-[13.5px] font-bold no-underline transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              color: "var(--color-dark)",
              borderColor: "var(--color-border)",
            }}
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
      </section>

      {/* ─── Recent Reviews ─── */}
      <section className="mx-auto max-w-[1180px] px-10 pt-20 pb-28">
        <SectionHeader
          eyebrow="Recent Reviews"
          title="Hear from the Gurus"
          subtitle="Honest, verified reviews from the coaches, parents and managers who actually showed up."
        />
        <div className="mt-7">
          <RecentReviewsSection />
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════ data sections ═══════════════════════════════ */

async function FeaturedEventsSection() {
  const { data: events, error } = await getFeaturedEvents();

  if (error || events.length === 0) {
    return (
      <EmptyState
        message={error ? "Couldn't load featured events right now." : "No featured events yet."}
        detail={error ? `${error}` : "Events with premium listings will appear here."}
      />
    );
  }

  return <FeaturedShowcase events={events} />;
}

function RecentReviewsSection() {
  // Static, role-varied reviews — public pages don't pull live user
  // reviews (privacy). Landing uses the same source; search + the event
  // page still surface real data. See lib/data/demo-recent-reviews.ts.
  return <ReviewShowcase reviews={DEMO_RECENT_REVIEWS as ReviewRow[]} />;
}

/* ═══════════════════════════════ shared UI ═══════════════════════════════ */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
      </div>
      <h2
        className="font-heading text-dark"
        style={{
          fontSize: "clamp(24px, 3.2vw, 34px)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.08,
          margin: 0,
          textWrap: "balance",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-2.5 mb-0"
          style={{
            fontSize: 15.5,
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
            maxWidth: 620,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div
      className="rounded-2xl border border-dashed bg-white text-center"
      style={{ borderColor: "#cbd5e1", padding: "36px 24px" }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }} aria-hidden="true">
        🏆
      </div>
      <div className="text-dark" style={{ fontSize: 15, fontWeight: 700 }}>
        {message}
      </div>
      {detail && (
        <div className="mt-1" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border bg-white"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="h-[150px] w-full bg-gray-200" />
          <div style={{ padding: "15px 16px" }}>
            <div className="h-5 w-3/4 rounded bg-gray-200" />
            <div className="mt-3 h-4 w-1/2 rounded bg-gray-100" />
            <div className="mt-3 h-4 w-full rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

