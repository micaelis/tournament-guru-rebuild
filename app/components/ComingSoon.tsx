import Link from "next/link";

/**
 * Lightweight placeholder for routes that are wired into navigation but not yet
 * built. Reuses the site's aurora backdrop + card craft so unfinished pages
 * still read as on-brand rather than as a raw 404.
 */
export function ComingSoon({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        minHeight: "calc(100dvh - 220px)",
        backgroundColor: "#eef2f9",
        backgroundImage:
          "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.12), transparent 56%)," +
          "radial-gradient(900px 620px at 104% 0%, rgba(15,23,42,.06), transparent 58%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="mx-auto w-full rounded-3xl border bg-white text-center"
        style={{
          maxWidth: 560,
          margin: "72px 24px",
          padding: "48px 40px",
          borderColor: "var(--color-border)",
          boxShadow:
            "0 20px 48px -24px rgba(15,23,42,.18), 0 2px 6px rgba(15,23,42,.04)",
        }}
      >
        <span
          className="font-heading inline-flex items-center gap-2 rounded-full"
          style={{
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#fff",
            background:
              "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
            boxShadow: "0 6px 16px -6px rgba(220,38,38,.5)",
          }}
        >
          {eyebrow}
        </span>

        <h1
          className="font-heading text-dark"
          style={{
            marginTop: 20,
            fontSize: "clamp(28px, 4.4vw, 38px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            textWrap: "balance",
          }}
        >
          {title}
        </h1>

        <p
          className="mx-auto"
          style={{
            marginTop: 14,
            marginBottom: 0,
            fontSize: 15.5,
            lineHeight: 1.6,
            color: "var(--color-text-secondary)",
            maxWidth: 420,
          }}
        >
          {body ?? "This page is on the way. Check back soon."}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="font-heading inline-flex items-center gap-1.5 rounded-xl no-underline transition-colors"
            style={{
              padding: "12px 22px",
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
              background: "var(--color-accent)",
            }}
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
