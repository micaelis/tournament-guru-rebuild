"use client";

/* Event detail page — all page-specific components live here so we
   don't refactor shared components on the site. Palette + typography
   come from globals.css (--color-accent, --color-gold, etc.); cards
   follow the rounded-2xl / --color-border / subtle-shadow convention
   established by the About and Directors pages. */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EventCard } from "@/app/components/EventCard";
import { Avatar } from "@/app/components/Avatar";
import { Stars } from "@/app/components/Stars";
import { ReviewCard } from "@/app/components/reviews/ReviewCard";
import type { CommentRow, ReviewCardRow } from "@/lib/reviews/queries";
import type {
  EventDetailRow,
  EventAgeGroupRow,
  SponsorRow,
  EventRow,
  DirectorProfile,
} from "@/app/components/types";
import { safeExternalUrl, safeImageSrc } from "@/lib/url";

/* ───────────────────────────────────────────────────────────────────
   Top-level layout
   ─────────────────────────────────────────────────────────────────── */

export function EventDetail({
  event,
  reviews,
  commentsByReview,
  helpfulReviewIds,
  currentUserId,
  isAdmin,
  bannedWords,
  ageGroups,
  sponsors,
  otherEvents,
  director,
}: {
  event: EventDetailRow;
  reviews: ReviewCardRow[];
  commentsByReview: Record<string, CommentRow[]>;
  helpfulReviewIds: string[];
  currentUserId: string | null;
  isAdmin: boolean;
  bannedWords: string[];
  ageGroups: EventAgeGroupRow[];
  sponsors: SponsorRow[];
  otherEvents: EventRow[];
  director: DirectorProfile | null;
}) {
  const concluded = eventConcluded(event.status, event.end_date);
  const displayHostName =
    director?.display_name ??
    event.host_club ??
    event.event_director ??
    "Event Host";
  // Contact host routes to the host's own registration / website — the
  // old contact_requests inbox was removed from the schema, so there's
  // no on-platform message to persist.
  const contactHref = safeExternalUrl(
    event.registration_link || event.this_year_website || event.website,
  );

  return (
    <div
      style={{
        backgroundColor: "#eef2f9",
        backgroundImage:
          "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.10), transparent 56%)," +
          "radial-gradient(980px 600px at 104% -8%, rgba(0,77,255,.08), transparent 56%)," +
          "radial-gradient(820px 820px at 100% 50%, rgba(245,158,11,.06), transparent 60%)," +
          "radial-gradient(1000px 900px at 40% 126%, rgba(124,58,237,.06), transparent 60%)",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="mx-auto max-w-[1240px] px-4 pt-6 pb-16 sm:px-6"
        style={{ paddingTop: "clamp(20px, 3vw, 32px)" }}
      >
        <Breadcrumb title={event.title} />

        <HeroGallery
          photos={event.photos ?? []}
          logo={event.logo}
          title={event.title}
          featured={!!event.premium}
        />

        <HeroHeader
          event={event}
          hostName={displayHostName}
          concluded={concluded}
        />

        <style>{`
          .tg-ev-main { grid-template-columns: minmax(0, 1fr); }
          @media (min-width: 1024px) {
            .tg-ev-main { grid-template-columns: minmax(0, 1fr) 360px; }
          }
        `}</style>
        <div className="tg-ev-main mt-8 grid gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <KeyFactsAboutCard event={event} ageGroups={ageGroups} />
            <KeyDatesCard event={event} concluded={concluded} />
            <LocationCard event={event} />
            <ReviewsSection
              event={event}
              reviews={reviews}
              commentsByReview={commentsByReview}
              helpfulReviewIds={helpfulReviewIds}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              bannedWords={bannedWords}
            />
            {sponsors.length > 0 && <SponsorsCard sponsors={sponsors} />}
            <OtherEventsCard
              events={otherEvents}
              hostName={displayHostName}
            />
          </div>

          <aside className="min-w-0">
            <div
              className="lg:sticky"
              style={{
                top: 96,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <ContactPanel
                event={event}
                director={director}
                hostName={displayHostName}
                ageGroups={ageGroups}
                contactHref={contactHref}
                concluded={concluded}
              />
              <ShareCard title={event.title} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Breadcrumb
   ─────────────────────────────────────────────────────────────────── */

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-2"
      style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)" }}
    >
      <Link
        href="/events"
        className="tg-hover inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5"
        style={{ border: "1px solid var(--color-border)", textDecoration: "none", color: "inherit" }}
      >
        <ArrowLeft />
        <span>Find Events</span>
      </Link>
      <span aria-hidden style={{ color: "var(--color-text-faint)" }}>›</span>
      <span className="truncate" style={{ color: "var(--color-dark-light)" }}>
        {title}
      </span>
    </nav>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Hero gallery
   1 large tile + 2×2 grid, with a "Show all N photos" modal.
   Empty state uses the same soccer-ball placeholder treatment as
   EventCard.
   ─────────────────────────────────────────────────────────────────── */

function HeroGallery({
  photos,
  logo,
  title,
  featured,
}: {
  photos: string[];
  logo: string | null;
  title: string;
  featured: boolean;
}) {
  const clean = (photos ?? []).filter(
    (p) => typeof p === "string" && p.trim().length > 0,
  );
  const total = clean.length;
  const [open, setOpen] = useState(false);

  if (total === 0) {
    return (
      <PlaceholderGallery title={title} logo={logo} featured={featured} />
    );
  }

  const [lead, ...rest] = clean;
  const grid = rest.slice(0, 4);

  return (
    <>
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,.7)",
          boxShadow: "0 24px 60px -30px rgba(15,23,42,.28), 0 4px 12px -6px rgba(15,23,42,.10)",
        }}
      >
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: grid.length > 0 ? "minmax(0, 1.35fr) minmax(0, 1fr)" : "1fr",
            minHeight: 380,
            background: "#fff",
          }}
        >
          <GalleryTile
            src={lead}
            alt={`${title} — photo 1`}
            large
            onClick={() => setOpen(true)}
          />
          {grid.length > 0 && (
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
              }}
            >
              {grid.map((src, i) => (
                <GalleryTile
                  key={`${src}-${i}`}
                  src={src}
                  alt={`${title} — photo ${i + 2}`}
                  onClick={() => setOpen(true)}
                />
              ))}
              {/* Fill blank tiles with a subtle placeholder so the 2×2
                  never has jarring empty slots. */}
              {Array.from({ length: Math.max(0, 4 - grid.length) }).map((_, i) => (
                <FillerTile key={`fill-${i}`} />
              ))}
            </div>
          )}
        </div>

        {featured && (
          <div className="absolute z-10" style={{ left: 14, top: 14 }}>
            <FeaturedPill />
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tg-hover absolute inline-flex items-center gap-2 rounded-full bg-white/95 font-heading"
          style={{
            right: 14,
            bottom: 14,
            padding: "9px 14px",
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--color-dark)",
            border: "1px solid rgba(15,23,42,.10)",
            boxShadow: "0 6px 18px -6px rgba(15,23,42,.28)",
            backdropFilter: "saturate(140%) blur(6px)",
            WebkitBackdropFilter: "saturate(140%) blur(6px)",
          }}
        >
          <GridIcon />
          Show all {total} photo{total === 1 ? "" : "s"}
        </button>
      </div>

      {open && (
        <GalleryModal
          photos={clean}
          title={title}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function GalleryTile({
  src,
  alt,
  large,
  onClick,
}: {
  src: string;
  alt: string;
  large?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tg-hover relative overflow-hidden"
      style={{
        border: 0,
        padding: 0,
        cursor: "pointer",
        background: "#e2e8f0",
        minHeight: large ? 380 : 186,
      }}
      aria-label={alt}
    >
      {/* Use raw <img> — photos come from an unknown remote host set
          per-event; next/image would need the host allow-listed.
          safeImageSrc drops non-http(s) URLs so a hostile director
          can't ship a javascript:/data: as a photo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={safeImageSrc(src) ?? undefined}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </button>
  );
}

function FillerTile() {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #f3f6fa 60%, #e9eef5 100%)",
        border: "1px solid #eef2f7",
      }}
    >
      <span
        className="tg-ball absolute inset-0 flex items-center justify-center"
        style={{ fontSize: 56, opacity: 0.12 }}
      >
        ⚽
      </span>
    </div>
  );
}

function PlaceholderGallery({
  title,
  logo,
  featured,
}: {
  title: string;
  logo: string | null;
  featured: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 20,
        border: "1px solid #eef2f7",
        minHeight: 300,
        background:
          "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #f3f6fa 60%, #e9eef5 100%)",
        boxShadow: "0 24px 60px -30px rgba(15,23,42,.28)",
      }}
    >
      {featured && (
        <div className="absolute z-10" style={{ left: 14, top: 14 }}>
          <FeaturedPill />
        </div>
      )}
      <span
        aria-hidden="true"
        className="tg-ball absolute inset-0 flex items-center justify-center"
        style={{ fontSize: 220, opacity: logo ? 0.06 : 0.12 }}
      >
        ⚽
      </span>
      {safeImageSrc(logo) ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={safeImageSrc(logo)!}
            alt={`${title} logo`}
            className="max-h-[220px] max-w-[60%] object-contain"
            style={{ filter: "drop-shadow(0 12px 24px rgba(15,23,42,.14))" }}
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span
            className="font-heading"
            style={{
              fontSize: 46,
              fontWeight: 800,
              color: "var(--color-text-faint)",
              letterSpacing: "-0.03em",
            }}
          >
            TG
          </span>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--color-text-muted)",
            }}
          >
            No photos yet
          </span>
        </div>
      )}
    </div>
  );
}

function FeaturedPill() {
  return (
    <span
      className="font-heading inline-flex items-center gap-1.5 uppercase text-white"
      style={{
        background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: ".14em",
        padding: "5px 10px 6px",
        borderRadius: 6,
        boxShadow: "0 6px 14px -4px rgba(220,38,38,.45)",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-gold-bright)" aria-hidden="true">
        <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
      </svg>
      Featured
    </span>
  );
}

function GalleryModal({
  photos,
  title,
  onClose,
}: {
  photos: string[];
  title: string;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} · all photos`}
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: "rgba(15,23,42,.72)", padding: 20, overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-[960px] rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 40px 80px -20px rgba(0,0,0,.5)" }}
      >
        <div
          className="sticky top-0 flex items-center justify-between rounded-t-2xl bg-white px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="min-w-0">
            <div
              className="font-heading truncate"
              style={{ fontSize: 15, fontWeight: 800, color: "var(--color-dark)" }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {photos.length} photo{photos.length === 1 ? "" : "s"}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="tg-hover rounded-full bg-[var(--color-surface-alt)] p-2"
            aria-label="Close gallery"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <CloseIcon />
          </button>
        </div>
        <div
          className="grid gap-2 p-4"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          {photos.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="overflow-hidden rounded-lg"
              style={{
                background: "#e2e8f0",
                gridColumn: i === 0 ? "1 / -1" : undefined,
                aspectRatio: i === 0 ? "16 / 9" : "4 / 3",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeImageSrc(src) ?? undefined}
                alt={`${title} photo ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Hero header — title row that sits under the gallery
   ─────────────────────────────────────────────────────────────────── */

function HeroHeader({
  event,
  hostName,
  concluded,
}: {
  event: EventDetailRow;
  hostName: string;
  concluded: boolean;
}) {
  const loc = compactLocation(event);
  const overall = numOr0(event.general_rating);
  const totalReviews = event.reviews ?? 0;

  return (
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {event.start_date && (
          <CalendarDate start={event.start_date} end={event.end_date} />
        )}
        <div className="min-w-0">
          <div
            className="mb-2 flex flex-wrap items-center gap-1.5"
            style={{ fontSize: 12 }}
          >
            {concluded ? (
              <StatusPill kind="concluded">Concluded</StatusPill>
            ) : event.status === "open" ? (
              <StatusPill kind="open">Open</StatusPill>
            ) : null}
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Hosted by {hostName}
            </span>
          </div>
          <h1
            className="font-heading"
            style={{
              fontSize: "clamp(28px, 4.4vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "var(--color-dark)",
              margin: 0,
              textWrap: "balance",
            }}
          >
            {event.title}
          </h1>
          <div
            className="mt-2 flex flex-wrap items-center gap-3"
            style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
          >
            {loc && (
              <span className="inline-flex items-center gap-1.5">
                <IconPin />
                {loc}
              </span>
            )}
            {totalReviews > 0 && (
              <span className="inline-flex items-center gap-2">
                <Stars rating={overall} count={totalReviews} size={14} />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GhostButton>
          <HeartIcon />
          <span>Save</span>
        </GhostButton>
        <GhostButton>
          <ShareIcon />
          <span>Share</span>
        </GhostButton>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Key facts + About + Age groups & pricing (single card)
   ─────────────────────────────────────────────────────────────────── */

function KeyFactsAboutCard({
  event,
  ageGroups,
}: {
  event: EventDetailRow;
  ageGroups: EventAgeGroupRow[];
}) {
  const ages = (event.event_ages ?? [])
    .map((a) => a.age.toUpperCase())
    .sort((a, b) => ageIndex(a) - ageIndex(b));
  const ageLabel =
    ages.length > 1
      ? `${ages[0]}–${ages[ages.length - 1]}`
      : ages[0] ?? "—";
  const genders = (event.event_genders ?? []).map((g) => capitalize(g.gender));
  const genderLabel =
    genders.length === 0 ? "—" : genders.length === 1 ? genders[0] : "Co-ed";
  const levels = (event.event_competition_levels ?? [])
    .map((l) => capitalize(l.level))
    .join(" · ") || "—";
  const surfaces = (event.event_fields ?? [])
    .map((f) => capitalize(f.surface))
    .join(" · ") || "—";
  const teams = event.nr_teams_last_year;

  return (
    <Card>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <FactTile label="Age Groups" value={ageLabel} icon={<AgeIcon />} />
        <FactTile label="Gender" value={genderLabel} icon={<UserIcon />} />
        <FactTile label="Level" value={levels} icon={<TrophyIcon />} />
        <FactTile label="Surface" value={surfaces} icon={<FieldIcon />} />
        <FactTile
          label="Teams last year"
          value={teams ? String(teams) : "—"}
          icon={<TeamsIcon />}
        />
        <FactTile
          label="Region"
          value={event.state || event.region || "—"}
          icon={<CompassIcon />}
        />
      </div>

      <Divider />

      <SectionH>About this tournament</SectionH>
      {event.description ? (
        <p
          className="mt-2"
          style={{
            fontSize: 14.5,
            lineHeight: 1.65,
            color: "var(--color-text-secondary)",
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {event.description}
        </p>
      ) : (
        <p
          className="mt-2 italic"
          style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}
        >
          The organizer hasn&apos;t added a description yet.
        </p>
      )}

      {ageGroups.length > 0 && (
        <>
          <Divider />
          <SectionH>Age groups &amp; pricing</SectionH>
          <div
            className="mt-3 grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
          >
            {ageGroups.map((g) => (
              <AgeGroupRow key={g.id} row={g} />
            ))}
          </div>
          <div className="mt-3">
            <InfoTip>
              Prices shown are per-team; some age groups may be assigned to
              different fields depending on registrations.
            </InfoTip>
          </div>
        </>
      )}
    </Card>
  );
}

function FactTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        border: "1px solid var(--color-border)",
        background: "#fff",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md"
          style={{ background: "#fef2f2", color: "var(--color-accent)" }}
        >
          {icon}
        </span>
        <span
          className="font-heading uppercase"
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: ".14em",
            color: "var(--color-text-muted)",
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="font-heading mt-1 truncate"
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--color-dark)",
          letterSpacing: "-0.01em",
        }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function AgeGroupRow({ row }: { row: EventAgeGroupRow }) {
  const parts: string[] = [];
  if (row.gender) parts.push(capitalize(row.gender));
  if (row.label) parts.push(row.label);
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-light)",
      }}
    >
      <div className="min-w-0">
        <div
          className="font-heading"
          style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-dark)" }}
        >
          {row.age?.toUpperCase() ?? "—"}
        </div>
        {parts.length > 0 && (
          <div
            className="mt-0.5 truncate"
            style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
          >
            {parts.join(" · ")}
          </div>
        )}
      </div>
      <div
        className="font-heading text-right"
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "var(--color-dark)",
          letterSpacing: "-0.01em",
        }}
      >
        {row.price != null ? `$${formatPrice(row.price)}` : "—"}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Key dates — a slim vertical timeline
   ─────────────────────────────────────────────────────────────────── */

function KeyDatesCard({
  event,
  concluded,
}: {
  event: EventDetailRow;
  concluded: boolean;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const milestones: {
    label: string;
    date: string | null;
    active?: boolean;
    kind: "done" | "next" | "event" | "upcoming";
  }[] = [];

  const created = event.created_at ? new Date(event.created_at) : null;
  const regDeadline = event.registration_deadline
    ? new Date(event.registration_deadline)
    : null;
  const startD = event.start_date ? new Date(event.start_date) : null;
  const endD = event.end_date ? new Date(event.end_date) : null;

  milestones.push({
    label: "Registration open",
    date: event.created_at,
    kind: (created && created <= today) ? "done" : "upcoming",
  });
  if (regDeadline) {
    milestones.push({
      label: "Registration deadline",
      date: event.registration_deadline,
      kind: regDeadline < today ? "done" : "next",
    });
  }
  if (startD) {
    milestones.push({
      label: "Event begins",
      date: event.start_date,
      kind: concluded ? "done" : "event",
    });
  }
  if (endD && event.end_date !== event.start_date) {
    milestones.push({
      label: "Event wraps up",
      date: event.end_date,
      kind: endD < today ? "done" : "upcoming",
    });
  }

  return (
    <Card>
      <SectionH>Key dates</SectionH>
      <ol className="mt-3 flex flex-col gap-0" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {milestones.map((m, i) => (
          <li
            key={`${m.label}-${i}`}
            className="relative flex items-start gap-4"
            style={{ paddingBottom: i === milestones.length - 1 ? 0 : 20 }}
          >
            {i !== milestones.length - 1 && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 11,
                  top: 22,
                  bottom: -4,
                  width: 2,
                  background: "var(--color-border)",
                  borderRadius: 1,
                }}
              />
            )}
            <MilestoneDot kind={m.kind} />
            <div className="flex-1">
              <div
                className="font-heading"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-dark)",
                  letterSpacing: "-0.005em",
                }}
              >
                {m.label}
              </div>
              <div
                className="mt-0.5"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                {m.date ? fmtFullDate(m.date) : "TBD"}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function MilestoneDot({
  kind,
}: {
  kind: "done" | "next" | "event" | "upcoming";
}) {
  if (kind === "done") {
    return (
      <span
        aria-hidden
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 24,
          height: 24,
          background: "#16a34a",
          border: "3px solid #fff",
          boxShadow: "0 0 0 1px #dcfce7",
          color: "#fff",
          zIndex: 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l4 4 10-11" />
        </svg>
      </span>
    );
  }
  if (kind === "event") {
    return (
      <span
        aria-hidden
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 24,
          height: 24,
          background: "var(--color-accent)",
          border: "3px solid #fff",
          boxShadow: "0 0 0 1px rgba(220,38,38,.20)",
          color: "#fff",
          zIndex: 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
        </svg>
      </span>
    );
  }
  if (kind === "next") {
    return (
      <span
        aria-hidden
        className="relative inline-block shrink-0 rounded-full"
        style={{
          width: 24,
          height: 24,
          background: "#fff",
          border: "3px solid var(--color-accent)",
          boxShadow: "0 0 0 3px rgba(220,38,38,.14)",
          zIndex: 1,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0 rounded-full"
      style={{
        width: 24,
        height: 24,
        background: "#fff",
        border: "3px solid var(--color-border)",
        zIndex: 1,
      }}
    />
  );
}

/* ───────────────────────────────────────────────────────────────────
   Location + nearest airports
   No airport table exists in the schema; use a small static state →
   major airport lookup so the section stays informative. Flagged
   to the user.
   ─────────────────────────────────────────────────────────────────── */

function LocationCard({ event }: { event: EventDetailRow }) {
  const loc = event.location_text?.trim() || null;
  const state = event.state?.trim().toUpperCase() || null;
  const airports = state ? AIRPORTS_BY_STATE[state] ?? [] : [];
  const mapsHref = loc
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`
    : state
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(state + " USA")}`
      : null;

  return (
    <Card>
      <SectionH>Location</SectionH>
      <div
        className="mt-3 grid gap-3"
        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        <div
          className="rounded-xl px-4 py-3.5"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-light)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <span
              className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
              style={{ background: "#fef2f2", color: "var(--color-accent)" }}
            >
              <IconPin />
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="font-heading"
                style={{ fontSize: 14, fontWeight: 700, color: "var(--color-dark)" }}
              >
                Venue
              </div>
              <div
                className="mt-0.5"
                style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
              >
                {loc ?? state ?? "Location coming soon"}
              </div>
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="tg-hover mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "var(--color-dark)",
                    textDecoration: "none",
                  }}
                >
                  Open in Google Maps
                  <ExternalIcon />
                </a>
              )}
            </div>
          </div>
        </div>

        {airports.length > 0 && (
          <div
            className="rounded-xl px-4 py-3.5"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-light)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <span
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
                style={{ background: "#eff6ff", color: "#1d4ed8" }}
              >
                <PlaneIcon />
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="font-heading"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--color-dark)",
                  }}
                >
                  Nearest major airports
                </div>
                <ul
                  className="mt-1.5 flex flex-wrap gap-1.5"
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                >
                  {airports.map((a) => (
                    <li key={a.code}>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1"
                        style={{
                          fontSize: 12,
                          border: "1px solid var(--color-border)",
                          color: "var(--color-dark-light)",
                        }}
                      >
                        <b
                          className="font-heading"
                          style={{ letterSpacing: "-0.005em" }}
                        >
                          {a.code}
                        </b>
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {a.name}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Reviews — banner + Ratings overview + filter/sort + list
   ─────────────────────────────────────────────────────────────────── */

function ReviewsSection({
  event,
  reviews,
  commentsByReview,
  helpfulReviewIds,
  currentUserId,
  isAdmin,
  bannedWords,
}: {
  event: EventDetailRow;
  reviews: ReviewCardRow[];
  commentsByReview: Record<string, CommentRow[]>;
  helpfulReviewIds: string[];
  currentUserId: string | null;
  isAdmin: boolean;
  bannedWords: string[];
}) {
  // Coach vs attendee pools follow the same split the ratings trigger
  // uses (reviewer_role = 'coach'). The rating-overview cards + filter
  // pills are main's design; each review row is the rebuild's interactive
  // ReviewCard so Helpful / Flag / comments keep firing.
  const isCoach = (r: ReviewCardRow) => r.reviewer_role === "coach";
  const coach = useMemo(() => reviews.filter(isCoach), [reviews]);
  const attendee = useMemo(() => reviews.filter((r) => !isCoach(r)), [reviews]);
  const coachAvg = avgRating(coach);
  const attendeeAvg = avgRating(attendee);
  const coachDist = distribution(coach);
  const attendeeDist = distribution(attendee);

  const showCoach = coach.length > 0;
  const showAttendee = attendee.length > 0;
  const bothHidden = !showCoach && !showAttendee;

  const helpfulSet = useMemo(
    () => new Set(helpfulReviewIds),
    [helpfulReviewIds],
  );

  const [filter, setFilter] = useState<"all" | "coach" | "attendee">("all");
  const [sort, setSort] = useState<"recent" | "top">("recent");

  const filtered = useMemo(() => {
    let out =
      filter === "all"
        ? reviews
        : reviews.filter((r) => (filter === "coach" ? isCoach(r) : !isCoach(r)));
    out = [...out];
    if (sort === "top") {
      out.sort((a, b) => numOr0(b.overall) - numOr0(a.overall));
    } else {
      out.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return out;
  }, [reviews, filter, sort]);

  return (
    <section id="reviews" className="flex flex-col gap-4">
      <ReviewBanner event={event} count={reviews.length} />

      {bothHidden ? (
        <EmptyReviewsCard />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionH>Ratings overview</SectionH>
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                {reviews.length} total review{reviews.length === 1 ? "" : "s"}
              </div>
            </div>

            <div
              className="mt-3 grid gap-4"
              style={{
                gridTemplateColumns:
                  showCoach && showAttendee ? "1fr 1fr" : "1fr",
              }}
            >
              {showCoach && (
                <RatingCard
                  label="Coach Rating"
                  avg={coachAvg}
                  count={coach.length}
                  dist={coachDist}
                  tone="accent"
                />
              )}
              {showAttendee && (
                <RatingCard
                  label="Attendee Rating"
                  avg={attendeeAvg}
                  count={attendee.length}
                  dist={attendeeDist}
                  tone="gold"
                />
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                Showing {filtered.length} of {reviews.length} review
                {reviews.length === 1 ? "" : "s"}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <FilterPills
                  value={filter}
                  onChange={setFilter}
                  totals={{
                    all: reviews.length,
                    coach: coach.length,
                    attendee: attendee.length,
                  }}
                  hideCoach={!showCoach}
                  hideAttendee={!showAttendee}
                />
                <select
                  className="tg-select rounded-full bg-white"
                  value={sort}
                  onChange={(e) =>
                    setSort(e.currentTarget.value as "recent" | "top")
                  }
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: "1px solid var(--color-border)",
                    padding: "6px 32px 6px 12px",
                    color: "var(--color-dark)",
                  }}
                  aria-label="Sort reviews"
                >
                  <option value="recent">Most recent</option>
                  <option value="top">Highest rated</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div
                className="mt-4 rounded-xl px-4 py-6 text-center"
                style={{
                  background: "var(--color-surface)",
                  border: "1px dashed var(--color-border)",
                  fontSize: 13.5,
                  color: "var(--color-text-muted)",
                }}
              >
                No reviews in this view.
              </div>
            ) : (
              <ul
                className="mt-4 flex flex-col gap-3.5"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {filtered.map((r) => (
                  <li key={r.id}>
                    <ReviewCard
                      review={r}
                      comments={commentsByReview[r.id] ?? []}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      helpful={helpfulSet.has(r.id)}
                      bannedWords={bannedWords}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function ReviewBanner({
  event,
  count,
}: {
  event: EventDetailRow;
  count: number;
}) {
  const year = event.start_date
    ? new Date(event.start_date).getFullYear()
    : new Date().getFullYear();
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 py-5"
      style={{
        background:
          "linear-gradient(135deg, #ef4444 0%, var(--color-accent) 45%, var(--color-accent-dark) 100%)",
        boxShadow: "0 20px 40px -18px rgba(220,38,38,.55)",
      }}
    >
      <StarField />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,.18)",
              border: "1px solid rgba(255,255,255,.28)",
              color: "#fff",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
            </svg>
          </span>
          <div className="min-w-0">
            <div
              className="font-heading uppercase"
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: ".18em",
                color: "rgba(255,255,255,.9)",
              }}
            >
              {count > 0 ? `Reviews · ${year} edition` : `Just attended · ${year} edition?`}
            </div>
            <div
              className="font-heading"
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#fff",
                textWrap: "balance",
              }}
            >
              {count > 0
                ? `What coaches and attendees are saying`
                : `Was your team at ${event.title}? Help others decide.`}
            </div>
          </div>
        </div>
        <a
          href={`/events/${event.id}/review`}
          className="tg-hover inline-flex items-center gap-1.5 rounded-full bg-white font-heading"
          style={{
            padding: "10px 16px",
            fontSize: 12.5,
            fontWeight: 800,
            color: "var(--color-accent-dark)",
            textDecoration: "none",
            boxShadow: "0 4px 14px -4px rgba(0,0,0,.25)",
          }}
        >
          <PencilIcon />
          Write a review
        </a>
      </div>
    </div>
  );
}

function StarField() {
  const stars = Array.from({ length: 14 });
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {stars.map((_, i) => {
        const seed = (i * 37) % 100;
        const seed2 = (i * 71) % 100;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${seed}%`,
              top: `${seed2}%`,
              width: 8 + (i % 3) * 4,
              height: 8 + (i % 3) * 4,
              opacity: 0.14 + (i % 3) * 0.05,
              transform: `rotate(${(i * 23) % 360}deg)`,
              color: "#fff",
            }}
          >
            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
              <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
            </svg>
          </span>
        );
      })}
    </div>
  );
}


function EmptyReviewsCard() {
  return (
    <div
      className="rounded-2xl border-dashed bg-white px-6 py-10 text-center"
      style={{ border: "1px dashed var(--color-border)" }}
    >
      <div
        aria-hidden
        className="mx-auto inline-flex h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{ background: "#fef2f2", color: "var(--color-accent)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
        </svg>
      </div>
      <div
        className="font-heading mt-3"
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: "var(--color-dark)",
          letterSpacing: "-0.01em",
        }}
      >
        Be the first to review this event
      </div>
      <p
        className="mx-auto mt-1.5 max-w-md"
        style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--color-text-muted)" }}
      >
        Once the event wraps, coaches and attendees can share their experience
        so future teams know what to expect.
      </p>
    </div>
  );
}

function RatingCard({
  label,
  avg,
  count,
  dist,
  tone,
}: {
  label: string;
  avg: number;
  count: number;
  dist: number[]; // [5-star count, 4, 3, 2, 1]
  tone: "accent" | "gold";
}) {
  const barColor = tone === "accent" ? "var(--color-accent)" : "var(--color-gold)";
  const chipBg = tone === "accent" ? "#fef2f2" : "#fffbeb";
  return (
    <div
      className="grid gap-4 rounded-xl p-4"
      style={{
        background: "#fff",
        border: "1px solid var(--color-border)",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)",
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md"
            style={{ background: chipBg, color: barColor }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
            </svg>
          </span>
          <span
            className="font-heading uppercase"
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".14em",
              color: "var(--color-text-muted)",
            }}
          >
            {label}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <b
            className="font-heading"
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--color-dark)",
              lineHeight: 1,
            }}
          >
            {avg.toFixed(2)}
          </b>
          <span
            style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-faint)" }}
          >
            /5
          </span>
        </div>
        <div className="mt-1.5">
          <Stars rating={avg} size={16} />
        </div>
        <div
          className="mt-1"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}
        >
          {count} review{count === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {dist.map((n, i) => {
          const star = 5 - i;
          const pct = count > 0 ? Math.round((n / count) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span
                className="font-heading text-right"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  minWidth: 22,
                }}
              >
                {star}★
              </span>
              <div
                className="flex-1 overflow-hidden rounded-full"
                style={{ height: 7, background: "#eef2f7" }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: barColor,
                    borderRadius: 999,
                    transition: "width .35s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  minWidth: 22,
                  textAlign: "right",
                }}
              >
                {n}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterPills({
  value,
  onChange,
  totals,
  hideCoach,
  hideAttendee,
}: {
  value: "all" | "coach" | "attendee";
  onChange: (v: "all" | "coach" | "attendee") => void;
  totals: { all: number; coach: number; attendee: number };
  hideCoach: boolean;
  hideAttendee: boolean;
}) {
  const options: { key: "all" | "coach" | "attendee"; label: string }[] = [
    { key: "all", label: `All (${totals.all})` },
  ];
  if (!hideCoach)
    options.push({ key: "coach", label: `Coaches (${totals.coach})` });
  if (!hideAttendee)
    options.push({ key: "attendee", label: `Attendees (${totals.attendee})` });

  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{
        background: "var(--color-surface-alt)",
        border: "1px solid var(--color-border)",
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="tg-hover font-heading rounded-full"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              background: active ? "var(--color-dark)" : "transparent",
              color: active ? "#fff" : "var(--color-text-secondary)",
              border: "none",
              cursor: "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}


/* ───────────────────────────────────────────────────────────────────
   Sponsors
   ─────────────────────────────────────────────────────────────────── */

function SponsorsCard({ sponsors }: { sponsors: SponsorRow[] }) {
  return (
    <Card>
      <SectionH>Sponsors</SectionH>
      <div
        className="mt-3 grid gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        {sponsors.map((s) => (
          <SponsorRowUI key={s.id} sponsor={s} />
        ))}
      </div>
    </Card>
  );
}

function SponsorRowUI({ sponsor }: { sponsor: SponsorRow }) {
  const content = (
    <>
      <div
        className="inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-light)",
        }}
      >
        {safeImageSrc(sponsor.logo) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeImageSrc(sponsor.logo)!}
            alt=""
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <span
            className="font-heading"
            style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text-faint)" }}
          >
            {(sponsor.name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div
          className="font-heading truncate"
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--color-dark)",
          }}
        >
          {sponsor.name || "Sponsor"}
        </div>
        {sponsor.link && (
          <div
            className="truncate"
            style={{ fontSize: 11.5, fontWeight: 600, color: "#0d9488" }}
          >
            Visit website
          </div>
        )}
      </div>
    </>
  );

  const sponsorHref = safeExternalUrl(sponsor.link);
  if (sponsorHref) {
    return (
      <a
        href={sponsorHref}
        target="_blank"
        rel="noopener noreferrer"
        className="tg-hover flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5"
        style={{
          border: "1px solid var(--color-border)",
          textDecoration: "none",
        }}
      >
        {content}
      </a>
    );
  }
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5"
      style={{ border: "1px solid var(--color-border)" }}
    >
      {content}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Other events by this organization — reuses the site's EventCard
   ─────────────────────────────────────────────────────────────────── */

function OtherEventsCard({
  events,
  hostName,
}: {
  events: EventRow[];
  hostName: string;
}) {
  if (events.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2
          className="font-heading"
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--color-dark)",
            margin: 0,
          }}
        >
          Other events by {hostName}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Sticky Contact panel — host identity, ratings summary, price band,
   dates, Contact Host button. No "Register Team" CTA per brief.
   ─────────────────────────────────────────────────────────────────── */

function ContactPanel({
  event,
  director,
  hostName,
  ageGroups,
  contactHref,
  concluded,
}: {
  event: EventDetailRow;
  director: DirectorProfile | null;
  hostName: string;
  ageGroups: EventAgeGroupRow[];
  contactHref: string | null;
  concluded: boolean;
}) {
  const priceRange = derivePriceRange(ageGroups);
  const registrationHref = safeExternalUrl(
    event.registration_link || event.this_year_website || event.website,
  );

  return (
    <div
      className="rounded-2xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        boxShadow:
          "0 24px 60px -30px rgba(15,23,42,.28), 0 4px 12px -6px rgba(15,23,42,.10)",
        padding: 20,
      }}
    >
      {/* Host identity */}
      <div className="flex items-center gap-3">
        <HostAvatar
          logo={director?.org_logo ?? null}
          picture={director?.profile_picture ?? null}
          name={hostName}
        />
        <div className="min-w-0">
          <div
            className="font-heading uppercase"
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: ".14em",
              color: "var(--color-text-muted)",
            }}
          >
            Hosted by
          </div>
          <div
            className="font-heading truncate"
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--color-dark)",
              letterSpacing: "-0.01em",
            }}
          >
            {hostName}
          </div>
          {director?.club_affiliation && (
            <div
              className="mt-0.5 truncate"
              style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
            >
              {director.club_affiliation}
            </div>
          )}
        </div>
      </div>

      {/* Price + dates row */}
      <div
        className="mt-4 grid gap-3"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        <PanelStat
          label="Price"
          value={priceRange ?? "Contact"}
          sub={priceRange ? "per team" : "for pricing"}
        />
        <PanelStat
          label="Dates"
          value={
            event.start_date
              ? fmtDateRange(event.start_date, event.end_date)
              : "TBD"
          }
          sub={
            event.start_date
              ? new Date(event.start_date).getFullYear().toString()
              : ""
          }
        />
      </div>

      {/* Buttons */}
      <div className="mt-4 flex flex-col gap-2">
        {contactHref ? (
          <a
            href={contactHref}
            target="_blank"
            rel="noopener noreferrer"
            className="tg-btn-primary tg-hover font-heading inline-flex items-center justify-center gap-2 rounded-full"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              padding: "12px 18px",
              fontSize: 13.5,
              fontWeight: 800,
              letterSpacing: "-0.005em",
              border: "none",
              cursor: "pointer",
              textDecoration: "none",
              boxShadow: "0 10px 22px -8px rgba(220,38,38,.5)",
            }}
          >
            <MailIcon />
            Contact host
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="font-heading inline-flex items-center justify-center gap-2 rounded-full"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              padding: "12px 18px",
              fontSize: 13.5,
              fontWeight: 800,
              letterSpacing: "-0.005em",
              border: "1px solid var(--color-border)",
              cursor: "default",
            }}
          >
            <MailIcon />
            Contact via host website
          </button>
        )}
        {registrationHref && !concluded && (
          <a
            href={registrationHref}
            target="_blank"
            rel="noopener noreferrer"
            className="tg-btn-ghost tg-hover font-heading inline-flex items-center justify-center gap-2 rounded-full bg-white"
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--color-dark)",
              border: "1px solid var(--color-border)",
              textDecoration: "none",
            }}
          >
            <ExternalIcon />
            Visit registration page
          </a>
        )}
      </div>

      {director?.org_description && (
        <>
          <Divider />
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-text-secondary)",
              margin: 0,
            }}
          >
            {director.org_description}
          </p>
        </>
      )}

      <div className="mt-4">
        <InfoTip>
          Questions about brackets, housing, or schedule? The host&apos;s
          registration page has the latest details.
        </InfoTip>
      </div>
    </div>
  );
}

function derivePriceRange(rows: EventAgeGroupRow[]): string | null {
  const prices = rows
    .map((r) => (r.price == null ? null : Number(r.price)))
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi
    ? `$${formatPrice(lo)}`
    : `$${formatPrice(lo)}–$${formatPrice(hi)}`;
}

function PanelStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-light)",
      }}
    >
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: ".14em",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      <div
        className="font-heading mt-1"
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "var(--color-dark)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mt-0.5"
          style={{ fontSize: 11, color: "var(--color-text-muted)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function HostAvatar({
  logo,
  picture,
  name,
}: {
  logo: string | null;
  picture: string | null;
  name: string;
}) {
  const src = logo ?? picture;
  if (src) {
    return (
      <span
        className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{
          background: "#fff",
          border: "1px solid var(--color-border-light)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={safeImageSrc(src) ?? undefined} alt="" className="h-full w-full object-contain p-1.5" />
      </span>
    );
  }
  return <Avatar name={name} size={48} />;
}

function ShareCard({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  const url = typeof window !== "undefined" ? window.location.href : "";
  const share = (target: "email" | "x" | "wa") => {
    const enc = encodeURIComponent(title);
    const encUrl = encodeURIComponent(url);
    const href =
      target === "email"
        ? `mailto:?subject=${enc}&body=${encUrl}`
        : target === "x"
          ? `https://twitter.com/intent/tweet?text=${enc}&url=${encUrl}`
          : `https://wa.me/?text=${enc}%20${encUrl}`;
    if (typeof window !== "undefined") window.open(href, "_blank");
  };

  return (
    <div
      className="rounded-2xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        padding: 16,
        boxShadow: "0 4px 12px -6px rgba(15,23,42,.10)",
      }}
    >
      <SectionH>Share with your team</SectionH>
      <div className="mt-2.5 grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <ShareBtn onClick={copy}>
          <CopyIcon />
          {copied ? "Copied!" : "Copy link"}
        </ShareBtn>
        <ShareBtn onClick={() => share("email")}>
          <MailIcon />
          Email
        </ShareBtn>
        <ShareBtn onClick={() => share("x")}>
          <XIcon />
          X
        </ShareBtn>
        <ShareBtn onClick={() => share("wa")}>
          <WhatsAppIcon />
          WhatsApp
        </ShareBtn>
      </div>
    </div>
  );
}

function ShareBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tg-hover font-heading inline-flex items-center justify-center gap-1.5 rounded-full bg-white"
      style={{
        padding: "9px 12px",
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--color-dark)",
        border: "1px solid var(--color-border)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}


/* ───────────────────────────────────────────────────────────────────
   Small primitives + icons
   ─────────────────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        padding: "22px 24px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      {children}
    </section>
  );
}

function SectionH({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-heading"
      style={{
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--color-dark)",
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      className="my-5"
      style={{
        height: 1,
        background: "var(--color-border-light)",
      }}
    />
  );
}

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex items-start gap-3 overflow-hidden rounded-xl px-3.5 py-3"
      style={{
        // Layered wash: slightly deeper on the top-left (near the icon),
        // fading to a whisper on the bottom-right. Gives the tip visible
        // depth without turning up the saturation.
        background:
          "linear-gradient(135deg, #eef0ff 0%, #f6f7ff 55%, #ffffff 100%)",
        border: "1px solid #c7d2fe",
        color: "#1e1b4b",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.65), 0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      {/* Left indigo accent stripe — 3 px vertical bar that signals
          "informational" without adding saturated background colour. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 3,
          background:
            "linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)",
        }}
      />
      {/* Indigo icon chip — a solid rounded-square with a white filled
          info glyph inside. Reads as intentional design element vs. the
          earlier flat stroked "i". */}
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-md"
        style={{
          width: 24,
          height: 24,
          background:
            "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
          color: "#fff",
          boxShadow:
            "0 3px 8px -3px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.30)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4.75a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM10.75 11h2.5v6.25h-2.5V11z" />
        </svg>
      </span>
      <div
        style={{
          fontSize: 12.75,
          lineHeight: 1.55,
          fontWeight: 500,
          paddingTop: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="tg-btn-ghost tg-hover font-heading inline-flex items-center gap-1.5 rounded-full bg-white"
      style={{
        padding: "8px 14px",
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--color-dark)",
        border: "1px solid var(--color-border)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function StatusPill({
  kind,
  children,
}: {
  kind: "open" | "concluded";
  children: React.ReactNode;
}) {
  const theme =
    kind === "open"
      ? { bg: "#ecfdf5", color: "#15803d", border: "#bbf7d0", dot: "#16a34a" }
      : { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", dot: "#94a3b8" };
  return (
    <span
      className="font-heading inline-flex items-center gap-1.5 uppercase"
      style={{
        fontSize: 10,
        padding: "3px 9px 3px 8px",
        borderRadius: 999,
        background: theme.bg,
        color: theme.color,
        fontWeight: 800,
        letterSpacing: ".08em",
        border: `1px solid ${theme.border}`,
      }}
    >
      <span
        aria-hidden
        style={{ width: 5, height: 5, borderRadius: 999, background: theme.dot }}
      />
      {children}
    </span>
  );
}

function CalendarDate({ start, end }: { start: string; end: string | null }) {
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const mon = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const sameMonth =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const header = sameMonth ? mon(s) : `${mon(s)}–${mon(e)}`;
  const days =
    s.getDate() === e.getDate()
      ? `${s.getDate()}`
      : `${s.getDate()}–${e.getDate()}`;
  const year = s.getFullYear();
  return (
    <div
      className="relative inline-flex shrink-0 flex-col items-stretch overflow-hidden text-center"
      style={{
        borderRadius: 12,
        background: "#fff",
        minWidth: 78,
        lineHeight: 1,
        border: "1px solid var(--color-border)",
        boxShadow: "0 4px 10px -4px rgba(15,23,42,.15)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 10,
          right: 10,
          height: 2,
          background: "var(--color-accent)",
          borderRadius: 1,
        }}
      />
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".16em",
          color: "var(--color-accent)",
          padding: "10px 12px 3px",
        }}
      >
        {header}
      </div>
      <div
        className="font-heading"
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "var(--color-dark)",
          padding: "3px 12px 4px",
          letterSpacing: "-0.03em",
        }}
      >
        {days}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: ".08em",
          color: "var(--color-text-faint)",
          padding: "0 12px 10px",
        }}
      >
        {year}
      </div>
    </div>
  );
}

/* Icons */
function ArrowLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}
function AgeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="currentColor" stroke="none">U</text>
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4 20c0-3.6 3.6-5.6 8-5.6s8 2 8 5.6" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v4a4 4 0 11-8 0V4z" />
      <path d="M4 6h4M20 6h-4M12 12v4M8 20h8" />
    </svg>
  );
}
function FieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M12 6v12M3 12h4M17 12h4" />
    </svg>
  );
}
function TeamsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2 20c0-3.4 3.2-5.2 7-5.2s7 1.8 7 5.2" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M22 19c0-2.7-2.4-4-5-4" />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-2 5-5 2 2-5 5-2z" />
    </svg>
  );
}
function PlaneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12l20-8-8 20-3-9-9-3z" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M10 14L20 4" />
      <path d="M20 14v6H4V4h6" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.53 3H20.5l-6.5 7.44L21.5 21h-6.02l-4.7-6.14L5.4 21H2.44l6.96-7.96L2 3h6.16l4.25 5.62L17.53 3zm-1.05 16.2h1.67L7.6 4.7H5.83L16.48 19.2z" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 3.5A11 11 0 003.6 17l-1.1 4.4 4.5-1.1a11 11 0 0013.5-16.8zM12 20a8 8 0 01-4.1-1.1l-.3-.2-2.7.7.7-2.6-.2-.3A8 8 0 1120 12a8 8 0 01-8 8zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.1-.3.1-.5 0-.2-.1-1-.4-2-1.3-.7-.6-1.2-1.4-1.4-1.7-.1-.2 0-.4.1-.5l.4-.4c.1-.2.2-.3.2-.5 0-.2-.4-1.2-.6-1.6-.1-.4-.3-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.9.8-.9 2 0 1.2.9 2.3 1 2.5.1.2 1.7 2.6 4.1 3.7.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.2z" />
    </svg>
  );
}

/* ───────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────── */

function eventConcluded(status: string | null, endDate: string | null) {
  if (status === "concluded") return true;
  if (!endDate) return false;
  const d = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function compactLocation(e: EventDetailRow): string | null {
  const raw = e.location_text?.trim();
  const state = e.state?.trim().toUpperCase() || null;
  if (!raw) return state;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^(usa|united states)$/i.test(p));
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i].match(/^([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
    if (m) {
      const st = m[1].toUpperCase();
      const city = parts[i - 1] ?? null;
      if (city) return `${city}, ${st}`;
      return st;
    }
  }
  return raw;
}

function fmtDateRange(start: string, end: string | null): string {
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${fmt(s).split(" ")[0]} ${s.getDate()}–${e.getDate()}`;
  }
  return `${fmt(s)} – ${fmt(e)}`;
}

function fmtFullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function numOr0(v: number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ageIndex(v: string): number {
  const m = /^u(\d+)$/i.exec(v);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPrice(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function avgRating(reviews: ReviewCardRow[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((a, r) => a + numOr0(r.overall), 0);
  return sum / reviews.length;
}

function distribution(reviews: ReviewCardRow[]): number[] {
  const buckets = [0, 0, 0, 0, 0]; // 5-star, 4, 3, 2, 1
  for (const r of reviews) {
    const v = numOr0(r.overall);
    if (v <= 0) continue;
    const star = Math.max(1, Math.min(5, Math.round(v)));
    buckets[5 - star]++;
  }
  return buckets;
}

/* Nearest major airports by US state. There is no per-event airport
   field on `events` — this is a client-side reference lookup so the
   Location card stays informative. Add or refine values as coverage
   grows; if per-event airports become important, add an
   `event_airports` join table and swap this out. */
const AIRPORTS_BY_STATE: Record<string, { code: string; name: string }[]> = {
  CA: [{ code: "LAX", name: "Los Angeles" }, { code: "SFO", name: "San Francisco" }, { code: "SAN", name: "San Diego" }],
  NY: [{ code: "JFK", name: "New York JFK" }, { code: "LGA", name: "New York LaGuardia" }, { code: "EWR", name: "Newark" }],
  TX: [{ code: "DFW", name: "Dallas/Fort Worth" }, { code: "IAH", name: "Houston" }, { code: "AUS", name: "Austin" }],
  FL: [{ code: "MCO", name: "Orlando" }, { code: "MIA", name: "Miami" }, { code: "TPA", name: "Tampa" }],
  IL: [{ code: "ORD", name: "Chicago O'Hare" }, { code: "MDW", name: "Chicago Midway" }],
  GA: [{ code: "ATL", name: "Atlanta" }],
  PA: [{ code: "PHL", name: "Philadelphia" }, { code: "PIT", name: "Pittsburgh" }],
  OH: [{ code: "CLE", name: "Cleveland" }, { code: "CMH", name: "Columbus" }, { code: "CVG", name: "Cincinnati" }],
  MI: [{ code: "DTW", name: "Detroit" }],
  NC: [{ code: "CLT", name: "Charlotte" }, { code: "RDU", name: "Raleigh-Durham" }],
  NJ: [{ code: "EWR", name: "Newark" }],
  VA: [{ code: "IAD", name: "Washington Dulles" }, { code: "DCA", name: "Reagan National" }, { code: "ORF", name: "Norfolk" }],
  MA: [{ code: "BOS", name: "Boston Logan" }],
  MD: [{ code: "BWI", name: "Baltimore/Washington" }],
  AZ: [{ code: "PHX", name: "Phoenix" }],
  CO: [{ code: "DEN", name: "Denver" }],
  WA: [{ code: "SEA", name: "Seattle-Tacoma" }],
  OR: [{ code: "PDX", name: "Portland" }],
  NV: [{ code: "LAS", name: "Las Vegas" }],
  UT: [{ code: "SLC", name: "Salt Lake City" }],
  MN: [{ code: "MSP", name: "Minneapolis/St Paul" }],
  MO: [{ code: "STL", name: "St. Louis" }, { code: "MCI", name: "Kansas City" }],
  IN: [{ code: "IND", name: "Indianapolis" }],
  WI: [{ code: "MKE", name: "Milwaukee" }],
  TN: [{ code: "BNA", name: "Nashville" }, { code: "MEM", name: "Memphis" }],
  KY: [{ code: "SDF", name: "Louisville" }, { code: "LEX", name: "Lexington" }],
  AL: [{ code: "BHM", name: "Birmingham" }, { code: "HSV", name: "Huntsville" }],
  LA: [{ code: "MSY", name: "New Orleans" }],
  SC: [{ code: "CHS", name: "Charleston" }, { code: "GSP", name: "Greenville-Spartanburg" }],
  IA: [{ code: "DSM", name: "Des Moines" }],
  KS: [{ code: "ICT", name: "Wichita" }],
  NE: [{ code: "OMA", name: "Omaha" }],
  OK: [{ code: "OKC", name: "Oklahoma City" }, { code: "TUL", name: "Tulsa" }],
  AR: [{ code: "XNA", name: "Northwest Arkansas" }, { code: "LIT", name: "Little Rock" }],
  MS: [{ code: "JAN", name: "Jackson" }],
  CT: [{ code: "BDL", name: "Hartford" }],
};
