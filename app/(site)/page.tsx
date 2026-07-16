import { Suspense } from "react";
import Image from "next/image";
import { HeroSearch } from "../components/HeroSearch";
import { FeaturedShowcase } from "../components/FeaturedShowcase";
import { WhoWeServe } from "../components/WhoWeServe";
import { ReviewShowcase } from "../components/ReviewShowcase";
import { ManifestoBand } from "../components/ManifestoBand";
import { SectionEyebrow } from "../components/SectionEyebrow";
import { HighlightSwipe } from "../components/HighlightSwipe";
import type { ReviewRow } from "@/app/components/types";
import { DEMO_RECENT_REVIEWS } from "@/lib/data/demo-recent-reviews";
import {
  fetchFeaturedEventRows,
  fetchPlatformStats,
  fetchPopularSearches,
} from "./queries";

export default async function HomePage() {
  // Stats are cheap counters — fetch once, share with the hero + manifesto.
  // Popular chips come from real logged searches (falls back to defaults).
  const [rawStats, popular] = await Promise.all([
    fetchPlatformStats(),
    fetchPopularSearches(),
  ]);
  const stats = {
    eventsCount: rawStats.events,
    reviewsCount: rawStats.reviews,
    tournamentsCount: rawStats.tournaments,
  };
  const popularTerms = popular.map((p) => p.term);

  return (
    <div
      style={{
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
      {/* ─── Hero ─── */}
      <HeroSearch
        stats={{
          eventsCount: stats.eventsCount,
          reviewsCount: stats.reviewsCount,
          tournamentsCount: stats.tournamentsCount,
        }}
        popular={popularTerms}
      />

      {/* ─── Group holding the two mid-page sections. The decorative photo
          lives INSIDE the Featured Events wrapper below, anchored to that
          section's top, so the ball always rides the "Find your next
          tournament" heading row no matter how tall the surrounding
          content is (the old %-of-group anchor drifted with data). */}
      <div className="relative isolate">
        {/* ─ Layer 2: Who We Serve ─ */}
        <section
          className="relative mx-auto max-w-[1280px] px-6 pb-14 md:px-10"
          style={{ paddingTop: 124 }}
        >
          <SectionHeader
            centered
            eyebrowChip
            titleSize="clamp(26px, 3.4vw, 38px)"
            eyebrow="Who We Serve"
            title={<>Built for coaches, parents &amp; organizers</>}
            subtitle="Two sides of every tournament weekend — we serve them both."
          />
          <WhoWeServe />
        </section>

        {/* ─ Layer 3: Featured Events ─
            No container chrome at all — the section sits directly on the
            page aurora (the earlier tinted showcase card read too heavy).
            The per-card "Featured" text label was dropped (see EventCard);
            the card border + dual coach/attendee ratings carry the
            differentiation. The wrapper hosts the decorative photo,
            anchored to the section top so the ball in the image rides the
            heading row regardless of surrounding content height. */}
        <div className="relative">
          {/* Decorative photo — right-anchored, capped at 55vw so the text
              column never fights the image. Feather is ASYMMETRIC on the
              horizontal axis: very heavy on the left (where the image meets
              the text column) and none on the right (which runs 40px past
              the viewport edge so no seam is ever visible). The negative top
              centers the layer's opaque band (42–58% of its 400px height)
              on the "Find your next tournament" heading. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -z-10 hidden md:block"
            style={{
              right: -40,
              top: -120,
              width: "55vw",
              maxWidth: "55vw",
              height: 400,
              overflow: "hidden",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, #000 42%, #000 58%, transparent 100%), linear-gradient(to right, transparent 0%, #000 48%, #000 100%)",
                WebkitMaskComposite: "source-in",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, #000 42%, #000 58%, transparent 100%), linear-gradient(to right, transparent 0%, #000 48%, #000 100%)",
                maskComposite: "intersect",
              }}
            >
              <Image
                src="/hero3.webp"
                alt=""
                fill
                sizes="55vw"
                className="object-cover"
                style={{ objectPosition: "center 55%" }}
              />
              {/* Pale wash lives INSIDE the mask so it only paints where the
                 image also paints — at the feathered edges both disappear
                 together, revealing the page aurora intact. */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, rgba(238,242,249,.65) 0%, rgba(238,242,249,.48) 45%, rgba(238,242,249,.32) 100%)",
                }}
              />
            </div>
          </div>

        <section id="featured-events" className="relative mx-auto max-w-[1280px] px-6 pb-32 md:px-10" style={{ scrollMarginTop: 80 }}>
          <div
            className="relative"
            style={{
              padding: "0 clamp(20px, 3vw, 48px)",
            }}
          >
            <div className="relative z-10 max-w-[720px]">
              <SectionHeader
                eyebrowChip
                eyebrow="Featured Events"
                titleSize="clamp(32px, 4.2vw, 52px)"
                title={
                  <>
                    Find your next{" "}
                    <span style={{ color: "var(--color-accent)" }}>tournament</span>
                  </>
                }
                subtitle={
                  <>
                    Featured Events bring together{" "}
                    <b style={{ color: "var(--color-dark)", fontWeight: 700 }}>Event Details</b>{" "}
                    verified by the host,{" "}
                    <b style={{ color: "var(--color-dark)", fontWeight: 700 }}>Coach &amp; Manager Reviews</b>{" "}
                    from those who’ve played it, and{" "}
                    <b style={{ color: "var(--color-dark)", fontWeight: 700 }}>Attendee Reviews</b>{" "}
                    from parents and spectators — the{" "}
                    <HighlightSwipe><b style={{ fontWeight: 600 }}>most comprehensive</b></HighlightSwipe>{" "}
                    picture of what to expect before you attend.{" "}
                    <span style={{ color: "var(--color-text-muted)" }}>
                      All Featured Event profiles are managed by the event operators.
                    </span>
                  </>
                }
              />
            </div>
            <div className="relative z-10 mt-9">
              <Suspense fallback={<FeaturedSkeleton />}>
                <FeaturedEventsSection />
              </Suspense>
            </div>
          </div>
        </section>
        </div>
      </div>


      {/* ─── Mission + Stats (dark manifesto band) ─── */}
      <ManifestoBand stats={stats} />

      {/* ─── Recent Reviews ─── */}
      <section className="mx-auto max-w-[1280px] px-6 pt-24 pb-28 md:px-10">
        <SectionHeader
          eyebrowChip
          eyebrow="Recent Reviews"
          title={
            <>
              Hear from the <HighlightSwipe>Gurus</HighlightSwipe>
            </>
          }
          subtitle="Real reviews from coaches and parents who actually attended."
        />
        <div className="mt-9">
          <RecentReviewsSection />
        </div>
      </section>
    </div>
  );
}


function SectionHeader({
  eyebrow,
  title,
  subtitle,
  centered = false,
  eyebrowChip = false,
  titleSize = "clamp(32px, 4.6vw, 50px)",
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  centered?: boolean;
  eyebrowChip?: boolean;
  titleSize?: string;
}) {
  return (
    <div style={centered ? { textAlign: "center" } : undefined}>
      {eyebrowChip ? (
        <div className="mb-4">
          <SectionEyebrow centered={centered}>{eyebrow}</SectionEyebrow>
        </div>
      ) : (
        <div
          className={`mb-3.5 flex items-center gap-2.5 ${centered ? "justify-center" : ""}`}
        >
          {!centered && (
            <span
              className="shrink-0 rounded-full"
              style={{ width: 6, height: 6, background: "var(--color-accent)" }}
              aria-hidden="true"
            />
          )}
          {centered && (
            <span
              className="h-px w-8"
              style={{ background: "var(--color-border)" }}
              aria-hidden="true"
            />
          )}
          <span
            className="font-heading whitespace-nowrap uppercase"
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--color-text-secondary)",
              letterSpacing: ".14em",
            }}
          >
            {eyebrow}
          </span>
          <span
            className={centered ? "h-px w-8" : "h-px flex-1"}
            style={{ background: "var(--color-border)" }}
            aria-hidden="true"
          />
        </div>
      )}
      <h2
        className="font-heading text-dark"
        style={{
          fontSize: titleSize,
          fontWeight: 800,
          letterSpacing: "-0.032em",
          lineHeight: 1.05,
          margin: 0,
          textWrap: "balance",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-4 mb-0"
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
            maxWidth: 640,
            ...(centered ? { marginLeft: "auto", marginRight: "auto" } : null),
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Async data sections
   ═══════════════════════════════════════════════════ */

async function FeaturedEventsSection() {
  const events = await fetchFeaturedEventRows();

  if (events.length === 0) {
    return (
      <EmptyState
        message="No featured events yet."
        detail="Events that are premium or sponsored will appear here."
      />
    );
  }

  return <FeaturedShowcase events={events} />;
}

function RecentReviewsSection() {
  /* Landing page uses the fixed demo reviews from lib/data — same copy as the
     Bubble export, with pre-assigned attendee/user types so the badges stay
     stable across reloads and independent of DB seed state. */
  return <ReviewShowcase reviews={DEMO_RECENT_REVIEWS as ReviewRow[]} />;
}

/* ═══════════════════════════════════════════════════
   Shared UI
   ═══════════════════════════════════════════════════ */

function EmptyState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div
      className="rounded-2xl border border-dashed bg-white text-center"
      style={{ borderColor: "#cbd5e1", padding: "36px 24px" }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }} aria-hidden="true">&#x1F3C6;</div>
      <div className="text-dark" style={{ fontSize: 15, fontWeight: 700 }}>{message}</div>
      {detail && (
        <div className="mt-1" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{detail}</div>
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
          <div className="h-[150px] bg-gray-200" />
          <div style={{ padding: "15px 16px 17px" }}>
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-3 h-3 w-1/2 rounded bg-gray-100" />
            <div className="mt-2 h-3 w-2/5 rounded bg-gray-100" />
            <div className="mt-3 h-3 w-full rounded bg-gray-100" />
            <div className="mt-4 flex items-center gap-2">
              <div className="h-7 w-14 rounded-full bg-gray-100" />
              <div className="h-9 w-12 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
