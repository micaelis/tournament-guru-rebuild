import { GetNoticedIntro } from "@/app/components/directors/GetNoticedIntro";
import { GetGrowingIntro } from "@/app/components/directors/GetGrowingIntro";
import { DirectorTestimonialShowcase } from "@/app/components/directors/DirectorTestimonialShowcase";
import { SectionEyebrow } from "@/app/components/SectionEyebrow";
import { EVENT_DIRECTOR_TESTIMONIALS } from "@/lib/data/event-director-testimonials";

export const metadata = { title: "For Event Directors · Tournament Guru" };

export default function HostPage() {
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
      {/* Page identity strip — same branded pill as the For Attendees
          page, echoes the landing hero's frosted chip on a light aurora
          background. */}
      <section className="mx-auto max-w-[1180px] px-10 pt-14 pb-4 text-center">
        <div className="mb-4">
          <SectionEyebrow centered>For Event Directors</SectionEyebrow>
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
          Two ways to reach more teams
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
          Claim your event to own the listing, then upgrade when you&rsquo;re
          ready to stand out among the crowd.
        </p>
      </section>

      {/* ─── Hub — two paths ─── */}
      <section className="mx-auto max-w-[1440px] px-10 pt-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GetNoticedIntro />
          <GetGrowingIntro />
        </div>
      </section>

      {/* ─── Event Director Testimonials ─── */}
      <section className="mx-auto max-w-[1180px] px-10 pt-24 pb-28">
        <SectionHeader
          eyebrow="Event Director Testimonials"
          title="Directors on Tournament Guru"
          subtitle="Words straight from the event organizers who’ve used the platform to grow their tournament."
        />
        <div className="mt-7">
          <DirectorTestimonialShowcase testimonials={EVENT_DIRECTOR_TESTIMONIALS} />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: "var(--color-accent)" }}
          aria-hidden="true"
        />
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
        <span className="h-px flex-1" style={{ background: "var(--color-border)" }} aria-hidden="true" />
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
