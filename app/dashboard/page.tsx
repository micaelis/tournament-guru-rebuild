import Link from "next/link";
import { requireSessionAndProfile } from "@/lib/supabase/session";

export const metadata = { title: "Dashboard · Tournament Guru" };

const ROLE_COPY: Record<
  "admin" | "event_director" | "attendee" | "company",
  { eyebrow: string; heading: string; body: string; primaryCta: { label: string; href: string } | null }
> = {
  admin: {
    eyebrow: "Admin",
    heading: "Everything the platform is doing, in one place.",
    body:
      "Review moderation queues, approve director claims, and keep the promo-code and contact pipelines flowing. Sections come online one at a time — the next one to land is Events.",
    primaryCta: { label: "Go to Events", href: "/dashboard/events" },
  },
  event_director: {
    eyebrow: "Event Director",
    heading: "Your events, reviews, and payouts.",
    body:
      "Manage the events you own, respond to what teams are saying, and track your transactions. Sections come online one at a time — the next one to land is Events.",
    primaryCta: { label: "Go to your events", href: "/dashboard/events" },
  },
  attendee: {
    eyebrow: "Your account",
    heading: "Your Tournament Guru account.",
    body:
      "Come back here to see your saved events, the reviews you've written, and manage your notification preferences. The full experience is being built section by section.",
    primaryCta: { label: "Browse events", href: "/events" },
  },
  company: {
    eyebrow: "Your account",
    heading: "Your Tournament Guru account.",
    body:
      "Company-specific tools are coming. In the meantime you can manage your account and read what's happening across the platform.",
    primaryCta: { label: "Browse events", href: "/events" },
  },
};

export default async function DashboardIndex() {
  const { profile } = await requireSessionAndProfile();
  const copy = ROLE_COPY[profile.user_type];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="shrink-0 rounded-full"
          aria-hidden="true"
          style={{ width: 6, height: 6, background: "var(--color-accent)" }}
        />
        <span
          className="font-heading uppercase"
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--color-text-secondary)",
            letterSpacing: ".14em",
          }}
        >
          {copy.eyebrow}
        </span>
        <span className="h-px flex-1" style={{ background: "var(--color-border)" }} aria-hidden="true" />
      </div>

      <h1
        className="font-heading text-dark"
        style={{
          fontSize: "clamp(26px, 3vw, 34px)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          margin: 0,
          textWrap: "balance",
          color: "var(--color-dark)",
        }}
      >
        {copy.heading}
      </h1>

      <p
        className="mt-3 mb-0"
        style={{
          fontSize: 15.5,
          lineHeight: 1.55,
          color: "var(--color-text-secondary)",
          maxWidth: 620,
        }}
      >
        {copy.body}
      </p>

      {copy.primaryCta && (
        <div className="mt-6">
          <Link
            href={copy.primaryCta.href}
            className="tg-hover inline-flex items-center rounded-full px-5 py-2.5 text-white"
            style={{
              fontSize: 14,
              fontWeight: 700,
              background:
                "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
              textDecoration: "none",
              boxShadow: "0 6px 16px -6px rgba(220,38,38,.5)",
            }}
          >
            {copy.primaryCta.label}
          </Link>
        </div>
      )}

      <div
        className="mt-10 rounded-2xl"
        style={{
          background: "#fff",
          border: "1px solid var(--color-border)",
          padding: "22px 24px",
        }}
      >
        <div
          className="font-heading uppercase"
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: ".14em",
            color: "var(--color-text-faint)",
            marginBottom: 8,
          }}
        >
          Signed in as
        </div>
        <div
          className="truncate"
          style={{ fontSize: 15, fontWeight: 700, color: "var(--color-dark)" }}
        >
          {profile.full_name?.trim() || profile.contact_email || "Account"}
        </div>
        <div
          className="mt-1 truncate"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          {profile.contact_email}
        </div>
      </div>
    </div>
  );
}
