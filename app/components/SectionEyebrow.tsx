/* SectionEyebrow — the small, chip-style kicker that leads section
   headings across the marketing pages (Featured Events, Recent Reviews,
   Who We Serve, etc.).

   Same visual family as the "For Attendees" identity strip and the
   About Us pill: white lifted pill + pulsing red brand dot + uppercase
   heading-font kicker. Left-aligned by default; pass `centered` for
   page-identity strips (Attendees / Event Directors hero).

   Kept as its own tiny file so every marketing page that used to
   inline its own dot-text-rule eyebrow can drop that markup and share
   one design system component. */

export function SectionEyebrow({
  children,
  centered = false,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "flex justify-center" : "flex"}>
      <div
        className="font-heading inline-flex items-center gap-2.5 rounded-full"
        style={{
          padding: "8px 16px 8px 12px",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid rgba(15,23,42,.08)",
          boxShadow:
            "0 2px 6px -1px rgba(15,23,42,.08), 0 8px 22px -14px rgba(15,23,42,.18), inset 0 1px 0 rgba(255,255,255,.9)",
        }}
      >
        <span
          aria-hidden="true"
          className="relative inline-flex"
          style={{ width: 7, height: 7 }}
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "var(--color-accent)",
              boxShadow: "0 0 8px rgba(220,38,38,.8)",
            }}
          />
          <span
            className="absolute inset-0 rounded-full tg-section-eyebrow-pulse"
            style={{ background: "var(--color-accent)" }}
          />
        </span>
        <span
          className="uppercase"
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: ".18em",
            color: "var(--color-dark)",
            lineHeight: 1,
          }}
        >
          {children}
        </span>
      </div>
      <style>{`
        .tg-section-eyebrow-pulse { animation: tg-eyebrow-pulse 1.8s ease-out infinite; opacity: .5; }
        @keyframes tg-eyebrow-pulse {
          0%   { transform: scale(1);   opacity: .5; }
          80%  { transform: scale(2.6); opacity: 0; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tg-section-eyebrow-pulse { animation: none; opacity: .5; }
        }
      `}</style>
    </div>
  );
}
