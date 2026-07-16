/**
 * Hand-drawn marker underline used behind key phrases across the site
 * (hero "Tournament Guru", "Gurus" in Recent Reviews, "were there" in
 * AuthPanel, etc.). Extracted from four near-identical copies scattered
 * across page.tsx / HeroSearch / AuthPanel / EventsSearch so a shape
 * or color change lands in one place.
 */
export function HighlightSwipe({
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
