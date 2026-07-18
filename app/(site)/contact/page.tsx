import { ContactForm } from "@/app/components/ContactForm";

export const metadata = {
  title: "Contact · Tournament Guru",
  description:
    "Get in touch with the Tournament Guru team — questions, feedback, or partnerships, we'd love to hear from you.",
};

/* ═══════════════════════════════════════════════════
   General Contact
   Left: simple "Get in Touch" pitch. Right: contact form
   (saves to contact_requests with source = 'general').
   ═══════════════════════════════════════════════════ */

const REASONS = [
  {
    key: "questions",
    label: "General questions",
    body: "Anything about how Tournament Guru works — we're happy to help.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.2 9.2a2.8 2.8 0 015.4 1c0 1.9-2.8 2.5-2.8 2.5" />
        <path d="M12 17.2h.01" />
      </svg>
    ),
  },
  {
    key: "feedback",
    label: "Feedback & ideas",
    body: "Spotted something, or have an idea to make the app better? Tell us.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    key: "partnerships",
    label: "Partnerships & press",
    body: "Working with organizers, media, or partners — start the conversation here.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  return (
    <div
      style={{
        backgroundColor: "#eef2f9",
        backgroundImage:
          "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.12), transparent 56%)," +
          "radial-gradient(900px 620px at 104% -8%, rgba(15,23,42,.06), transparent 58%)," +
          "radial-gradient(800px 640px at 100% 50%, rgba(220,38,38,.06), transparent 55%)," +
          "radial-gradient(700px 500px at 40% 126%, rgba(15,23,42,.04), transparent 60%)",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <section
        className="mx-auto max-w-[1200px] px-6 md:px-10"
        style={{ paddingTop: 76, paddingBottom: 100 }}
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* ── Left: pitch (sticky on desktop) ── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: "var(--color-accent)" }}
                aria-hidden="true"
              />
              <span
                className="font-heading uppercase"
                style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text-secondary)", letterSpacing: ".14em" }}
              >
                Contact
              </span>
            </div>

            <h1
              className="font-heading text-dark"
              style={{
                fontSize: "clamp(34px, 4.8vw, 52px)",
                fontWeight: 800,
                letterSpacing: "-0.034em",
                lineHeight: 1.05,
                margin: 0,
                textWrap: "balance",
              }}
            >
              Get in{" "}
              <span style={{ color: "var(--color-accent)" }}>touch</span>
            </h1>

            <p
              className="mb-0"
              style={{ marginTop: 16, fontSize: 16.5, lineHeight: 1.6, color: "var(--color-text-secondary)", maxWidth: 520 }}
            >
              Have a question, some feedback, or just want to say hello? Send us a
              note and our team will get back to you.
            </p>

            {/* Reasons to reach out */}
            <div
              className="mt-9 rounded-3xl border"
              style={{
                borderColor: "var(--color-border)",
                background: "linear-gradient(160deg, #fff 62%, #f1f5f9 100%)",
                boxShadow: "0 18px 44px -26px rgba(15,23,42,.18), 0 2px 6px rgba(15,23,42,.04)",
                padding: "10px 24px",
              }}
            >
              {REASONS.map((r, i) => (
                <div
                  key={r.key}
                  className="flex items-start gap-4"
                  style={{
                    padding: "20px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--color-border-light)",
                  }}
                >
                  <span
                    className="inline-flex shrink-0 items-center justify-center rounded-xl text-white"
                    style={{
                      width: 42,
                      height: 42,
                      background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                      boxShadow: "0 6px 14px -5px rgba(220,38,38,.5)",
                    }}
                  >
                    {r.icon}
                  </span>
                  <div>
                    <div
                      className="font-heading text-dark"
                      style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-0.01em" }}
                    >
                      {r.label}
                    </div>
                    <p
                      className="mb-0"
                      style={{ marginTop: 3, fontSize: 13.5, lineHeight: 1.55, color: "var(--color-text-secondary)" }}
                    >
                      {r.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: form ── */}
          <div>
            <div
              className="rounded-3xl border bg-white"
              style={{
                borderColor: "var(--color-border)",
                boxShadow: "0 24px 56px -28px rgba(15,23,42,.22), 0 2px 6px rgba(15,23,42,.04)",
                padding: "36px 32px",
              }}
            >
              {/* Heading + subtitle live inside ContactForm so they swap
                  out together with the form on success. */}
              <ContactForm source="general" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
