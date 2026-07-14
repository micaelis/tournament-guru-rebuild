import type { EventDirectorTestimonial } from "@/lib/data/event-director-testimonials";
import { safeImageSrc } from "@/lib/url";

/* A responsive, editorial testimonial grid for the /host page. The first
   entry gets a lead ("hero") card treatment; the rest fall into a compact
   3-up (2-up on tablet, 1-up on mobile) grid below it. Photos are the ones
   supplied in the CSV export and are decorative (rendered via <img> so the
   Bubble CDN hosts them unchanged). */
export function DirectorTestimonialShowcase({
  testimonials,
}: {
  testimonials: EventDirectorTestimonial[];
}) {
  if (testimonials.length === 0) return null;
  const [lead, ...rest] = testimonials;

  return (
    <div className="flex flex-col gap-5">
      <LeadTestimonial testimonial={lead} />
      {rest.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadTestimonial({
  testimonial: t,
}: {
  testimonial: EventDirectorTestimonial;
}) {
  return (
    <figure
      className="relative isolate grid grid-cols-1 gap-6 overflow-hidden rounded-3xl bg-white md:grid-cols-[220px_1fr]"
      style={{
        border: "1px solid var(--color-border)",
        boxShadow:
          "0 14px 40px -22px rgba(15,23,42,.22), 0 1px 2px rgba(15,23,42,.04)",
        margin: 0,
      }}
    >
      {/* Photo */}
      <div className="relative min-h-[180px] md:min-h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safeImageSrc(t.photo) ?? undefined}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,23,42,0) 40%, rgba(15,23,42,.35) 100%)",
          }}
        />
      </div>

      {/* Copy */}
      <div className="relative z-[1]" style={{ padding: "28px 32px 30px" }}>
        <svg
          width="40"
          height="32"
          viewBox="0 0 40 32"
          fill="rgba(220,38,38,.16)"
          aria-hidden="true"
          style={{ marginBottom: 4 }}
        >
          <path d="M0 32V18C0 8 6 1.5 16 0l2 5C11 6.5 8 10 8 15h7v17H0zm22 0V18C22 8 28 1.5 38 0l2 5c-7 1.5-10 5-10 10h7v17H22z" />
        </svg>

        <blockquote
          className="font-heading text-dark"
          style={{
            margin: 0,
            fontSize: "clamp(18px, 2vw, 22px)",
            fontWeight: 500,
            letterSpacing: "-0.015em",
            lineHeight: 1.42,
          }}
        >
          &ldquo;{t.quote}&rdquo;
        </blockquote>

        <figcaption
          className="mt-6 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--color-border-light)", paddingTop: 16 }}
        >
          <div className="min-w-0">
            <div className="text-dark" style={{ fontSize: 14.5, fontWeight: 700 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {t.eventTitle}
            </div>
          </div>
          <span
            className="font-heading uppercase"
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: ".08em",
              color: "#fff",
              background:
                "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
              padding: "3px 10px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            Event Director
          </span>
        </figcaption>
      </div>
    </figure>
  );
}

function TestimonialCard({
  testimonial: t,
}: {
  testimonial: EventDirectorTestimonial;
}) {
  return (
    <figure
      className="relative flex flex-col overflow-hidden rounded-[14px] border bg-white"
      style={{ borderColor: "var(--color-border)", padding: 0, margin: 0 }}
    >
      <div className="relative" style={{ paddingTop: "56%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safeImageSrc(t.photo) ?? undefined}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col" style={{ padding: "14px 16px 16px" }}>
        <svg
          width="24"
          height="20"
          viewBox="0 0 40 32"
          fill="rgba(220,38,38,.22)"
          aria-hidden="true"
          style={{ marginBottom: 2 }}
        >
          <path d="M0 32V18C0 8 6 1.5 16 0l2 5C11 6.5 8 10 8 15h7v17H0zm22 0V18C22 8 28 1.5 38 0l2 5c-7 1.5-10 5-10 10h7v17H22z" />
        </svg>
        <blockquote
          className="mb-0 flex-1"
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--color-dark-light)",
          }}
        >
          &ldquo;{t.quote}&rdquo;
        </blockquote>
        <figcaption
          className="mt-3 flex items-center justify-between gap-2"
          style={{ borderTop: "1px solid var(--color-border-light)", paddingTop: 10 }}
        >
          <div className="min-w-0">
            <div className="truncate text-dark" style={{ fontSize: 13, fontWeight: 700 }}>
              {t.name}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
            >
              {t.eventTitle}
            </div>
          </div>
        </figcaption>
      </div>
    </figure>
  );
}
