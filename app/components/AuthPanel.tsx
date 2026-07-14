"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Stars } from "./Stars";

/**
 * Right-hand marketing panel for the auth split-screen. Purely presentational
 * (aria-hidden). Two variants toggled by `?panel=` on the URL:
 *   • default          → attendee-facing (reviews-first pitch)
 *   • ?panel=director  → event-director-facing (list / claim pitch)
 *
 * Design language mirrors the public marketing pages: the eyebrow chip and
 * HighlightSwipe underline are the same primitives used on the homepage
 * `SectionHeader` and hero, and the sample cards echo the FeaturedShowcase +
 * ReviewShowcase visuals so users signing up recognise the product they just
 * came from.
 */
export function AuthPanel() {
  return (
    <Suspense fallback={<PanelShell>{null}</PanelShell>}>
      <AuthPanelInner />
    </Suspense>
  );
}

function AuthPanelInner() {
  const sp = useSearchParams();
  const variant = sp.get("panel") === "director" ? "director" : "attendee";
  return variant === "director" ? <DirectorPanel /> : <AttendeePanel />;
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <aside
      aria-hidden="true"
      className="tg-aurora relative hidden overflow-hidden lg:flex"
      style={{
        flexDirection: "column",
        justifyContent: "center",
        padding: "56px 60px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
        {children}
      </div>
    </aside>
  );
}

/* ══════════════════ Attendee variant ══════════════════ */

function AttendeePanel() {
  return (
    <PanelShell>
      <EyebrowChip>For coaches, parents &amp; managers</EyebrowChip>

      <PanelHeading>
        Every tournament, weighed in by the people who{" "}
        <HighlightSwipe>were there</HighlightSwipe>.
      </PanelHeading>

      <PanelBody>
        Get the facts from the Gurus — verified reviews from the coaches,
        parents, and team managers who actually showed up.
      </PanelBody>

      <StatRow
        items={[
          { value: "1,400+", label: "Events" },
          { value: "3,200+", label: "Reviews" },
          { value: "820+", label: "Tournaments" },
        ]}
      />

      <div className="mt-6 grid gap-4">
        <SampleReviewCard
          name="Marc Freeman"
          role="Coach"
          isGuru
          eventTitle="Midwest Junior Championships"
          rating={4.8}
          body="Well-run, competitive brackets, and the ref crews were sharp all weekend. Fields drained fast after the storm — no delays on Sunday."
        />

        <SampleEventCard
          title="West Coast Champions Cup"
          location="San Diego, CA"
          dateRange="Mar 15–17"
          rating={4.9}
          reviews={128}
          premium
        />
      </div>
    </PanelShell>
  );
}

/* ══════════════════ Director variant ══════════════════ */

function DirectorPanel() {
  return (
    <PanelShell>
      <EyebrowChip>For Event Directors</EyebrowChip>

      <PanelHeading>
        Own your listing. Reach <HighlightSwipe>every team</HighlightSwipe>{" "}
        looking for their next tournament.
      </PanelHeading>

      <PanelBody>
        Tournament Guru lists every publicly-known event in the country.
        Claiming yours puts you in front of thousands of coaches, parents and
        team managers actively searching — and lets you shape what they see.
      </PanelBody>

      <StatRow
        items={[
          { value: "1,400+", label: "Listed events" },
          { value: "12k", label: "Monthly visitors" },
          { value: "94%", label: "Reviews from attendees" },
        ]}
      />

      <div className="mt-6 grid gap-4">
        <SampleEventCard
          title="West Coast Champions Cup"
          location="San Diego, CA"
          dateRange="Mar 15–17"
          rating={4.9}
          reviews={128}
          premium
          claimed
        />

        <SampleReviewCard
          name="Jolie Rodriguez"
          role="Parent / Spectator"
          eventTitle="West Coast Champions Cup"
          rating={5}
          body="Best-run event we've been to this season. Clear schedule, great facilities, and the staff went out of their way to help."
        />
      </div>
    </PanelShell>
  );
}

/* ─────────────── shared panel bits ─────────────── */

/** Homepage-style eyebrow chip: white pill, thin border, red dot + uppercase. */
function EyebrowChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-heading inline-flex items-center gap-2 whitespace-nowrap rounded-full uppercase"
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        letterSpacing: ".14em",
        color: "var(--color-accent)",
        background: "#fff",
        border: "1px solid var(--color-border)",
        padding: "7px 15px",
        boxShadow: "0 2px 10px -3px rgba(15,23,42,.12)",
      }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 rounded-full"
        style={{ width: 6, height: 6, background: "var(--color-accent)" }}
      />
      {children}
    </span>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-heading"
      style={{
        marginTop: 20,
        marginBottom: 0,
        fontSize: "clamp(28px, 3vw, 34px)",
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: "-0.03em",
        color: "var(--color-dark)",
        textWrap: "balance",
      }}
    >
      {children}
    </h2>
  );
}

function PanelBody({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        marginTop: 14,
        marginBottom: 24,
        fontSize: 15.5,
        lineHeight: 1.6,
        color: "var(--color-text-secondary)",
        maxWidth: 460,
      }}
    >
      {children}
    </p>
  );
}

/**
 * Homepage marker-underline swipe — used behind the accent word so the panel
 * hero echoes the "most comprehensive" underline on the homepage exactly.
 */
function HighlightSwipe({
  children,
  color = "rgba(220,38,38,.22)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
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
          fill={color}
        />
      </svg>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

/** Compact 3-metric row — same visual grammar as the dark ManifestoBand on
 *  the homepage, but lightened for the aurora background. */
function StatRow({
  items,
}: {
  items: { value: string; label: string }[];
}) {
  return (
    <div
      className="flex items-stretch gap-4 rounded-2xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        padding: "14px 18px",
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex flex-1 flex-col items-start"
          style={{
            borderLeft:
              i === 0 ? "none" : "1px solid var(--color-border-light)",
            paddingLeft: i === 0 ? 0 : 16,
          }}
        >
          <span
            className="font-heading text-dark"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {item.value}
          </span>
          <span
            className="font-heading uppercase"
            style={{
              marginTop: 6,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".12em",
              color: "var(--color-text-muted)",
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Sample review card — mirrors the real ReviewCard's grammar
      (avatar circle, role badge, guru badge, star row, excerpt). ── */

function SampleReviewCard({
  name,
  role,
  isGuru = false,
  eventTitle,
  rating,
  body,
}: {
  name: string;
  role: string;
  isGuru?: boolean;
  eventTitle: string;
  rating: number;
  body: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <div
      className="rounded-2xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        padding: 18,
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
          style={{
            width: 38,
            height: 38,
            fontSize: 13,
            background: "linear-gradient(135deg, #64748b 0%, #334155 100%)",
          }}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="truncate text-dark"
              style={{ fontSize: 13.5, fontWeight: 700 }}
            >
              {name}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <RoleBadgeSample role={role} />
              {isGuru && <GuruBadgeSample />}
            </span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--color-text-muted)",
              marginTop: 1,
            }}
          >
            {eventTitle}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center">
        <Stars rating={rating} size={13} />
      </div>

      <p
        style={{
          marginTop: 8,
          marginBottom: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--color-text-secondary)",
        }}
      >
        {body}
      </p>
    </div>
  );
}

/* Static role-badge pill that mimics the tones used by the real RoleBadge
   without pulling in its Supabase-typed data model. */
function RoleBadgeSample({ role }: { role: string }) {
  const tone = TONES[role] ?? TONES["Attendee"];
  return (
    <span
      className="font-heading inline-flex shrink-0 items-center rounded-full uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".07em",
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {role}
    </span>
  );
}

const TONES: Record<string, { color: string; bg: string; border: string }> = {
  Coach: { color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  "Parent / Spectator": { color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  "Team Manager": { color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  Attendee: { color: "#475569", bg: "#f1f5f9", border: "#e2e8f0" },
};

function GuruBadgeSample() {
  return (
    <span
      className="font-heading inline-flex shrink-0 items-center gap-1 rounded-full uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".08em",
        color: "#b91c1c",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
      </svg>
      Guru
    </span>
  );
}

/* ── Sample event card — mirrors FeaturedShowcase card visuals
      (host monogram tile, date range, star rating, premium/claimed pills). ── */

function SampleEventCard({
  title,
  location,
  dateRange,
  rating,
  reviews,
  premium = false,
  claimed = false,
}: {
  title: string;
  location: string;
  dateRange: string;
  rating: number;
  reviews: number;
  premium?: boolean;
  claimed?: boolean;
}) {
  const monogram = title
    .split(" ")
    .filter((w) => w[0] && /[A-Z]/.test(w[0]))
    .map((w) => w[0])
    .slice(0, 3)
    .join("");

  return (
    <div
      className="relative rounded-2xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        padding: 18,
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      {premium && (
        <span
          aria-hidden="true"
          className="font-heading absolute uppercase"
          style={{
            top: 12,
            right: 12,
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: ".1em",
            color: "#fff",
            background:
              "linear-gradient(135deg, var(--color-gold-bright) 0%, var(--color-gold) 100%)",
            padding: "4px 9px",
            borderRadius: 999,
            boxShadow: "0 4px 10px -3px rgba(245,158,11,.5)",
          }}
        >
          Premium
        </span>
      )}

      <div className="flex items-start gap-3">
        <span
          className="font-heading inline-flex shrink-0 items-center justify-center rounded-xl text-white"
          style={{
            width: 52,
            height: 52,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            background:
              "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
          }}
        >
          {monogram}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="font-heading text-dark truncate"
            style={{
              fontSize: 15.5,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          <div
            className="mt-0.5 truncate"
            style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
          >
            {location} · {dateRange}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Stars rating={rating} count={reviews} size={12.5} />
            {claimed && (
              <span
                className="font-heading uppercase"
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  color: "#0f766e",
                  background: "#f0fdfa",
                  border: "1px solid #99f6e4",
                  padding: "2px 7px",
                  borderRadius: 999,
                }}
              >
                Claimed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
