/**
 * Long-form legal/content page layout: aurora backdrop, single white
 * article card, left-aligned reading measure. Copy is client-provided and
 * rendered verbatim — structure (headings, lists) is the only styling
 * applied here; never edit the strings in the page files.
 */

export type LegalSection = {
  heading: string;
  /** Plain paragraphs rendered in order, before any bullet list. */
  paragraphs?: string[];
  /** One-line lead-in shown directly above the bullet list. */
  lead?: string;
  bullets?: string[];
};

export function LegalArticle({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string[];
  sections: LegalSection[];
}) {
  return (
    <div
      style={{
        backgroundColor: "#eef2f9",
        backgroundImage:
          "radial-gradient(1040px 640px at -4% -14%, rgba(220,38,38,.12), transparent 56%)," +
          "radial-gradient(900px 620px at 104% 0%, rgba(15,23,42,.06), transparent 58%)",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto max-w-[820px] px-5 py-16">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: "var(--color-accent)" }}
        >
          {eyebrow}
        </p>
        <h1
          className="font-heading mt-3"
          style={{
            fontSize: "clamp(30px, 4.4vw, 42px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: "var(--color-dark)",
          }}
        >
          {title}
        </h1>

        <article
          className="mt-8 rounded-3xl border bg-white"
          style={{
            borderColor: "var(--color-border)",
            padding: "clamp(28px, 5vw, 48px)",
            boxShadow:
              "0 20px 48px -24px rgba(15,23,42,.18), 0 2px 6px rgba(15,23,42,.04)",
          }}
        >
          {intro.map((p) => (
            <p
              key={p.slice(0, 40)}
              className="mt-0 mb-4 last:mb-0"
              style={{
                fontSize: 15.5,
                lineHeight: 1.7,
                color: "var(--color-text-secondary)",
              }}
            >
              {p}
            </p>
          ))}

          {sections.map((s) => (
            <section key={s.heading}>
              <h2
                className="font-heading"
                style={{
                  marginTop: 34,
                  marginBottom: 12,
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  color: "var(--color-dark)",
                }}
              >
                {s.heading}
              </h2>
              {s.paragraphs?.map((p) => (
                <p
                  key={p.slice(0, 40)}
                  className="mt-0 mb-4 last:mb-0"
                  style={{
                    fontSize: 15.5,
                    lineHeight: 1.7,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {p}
                </p>
              ))}
              {s.lead ? (
                <p
                  className="mt-0 mb-3"
                  style={{
                    fontSize: 15.5,
                    lineHeight: 1.7,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {s.lead}
                </p>
              ) : null}
              {s.bullets ? (
                <ul className="my-0 flex list-none flex-col gap-2.5 p-0">
                  {s.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3"
                      style={{
                        fontSize: 15.5,
                        lineHeight: 1.7,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      <span
                        aria-hidden
                        className="mt-[9px] inline-block shrink-0 rounded-full"
                        style={{
                          width: 7,
                          height: 7,
                          background: "var(--color-accent)",
                        }}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
