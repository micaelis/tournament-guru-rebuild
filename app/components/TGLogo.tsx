import Link from "next/link";
import type { Route } from "next";

/**
 * Shared brand mark — the real Tournament Guru logo lockup (/logo.svg,
 * monogram + wordmark). Used by the site Header, Footer, the auth shell, and
 * the onboarding shell so the logo is identical everywhere.
 *
 * `variant="light"` renders a reversed (white) logo for dark backgrounds
 * such as the footer.
 */
const HEIGHTS = { sm: 34, md: 48, lg: 50 } as const;

export function TGLogo({
  href = "/",
  size = "md",
  variant = "dark",
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}) {
  const height = HEIGHTS[size];

  const inner = (
    // Plain <img>: the logo is a tiny inline SVG, so next/image optimization
    // would add overhead without benefit.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="Tournament Guru"
      style={{
        height,
        width: "auto",
        display: "block",
        // Reverse to solid white on dark surfaces.
        filter: variant === "light" ? "brightness(0) invert(1)" : undefined,
      }}
    />
  );

  if (href === null) return inner;

  return (
    <Link
      href={href as Route}
      className="inline-flex no-underline"
      aria-label="Tournament Guru — home"
    >
      {inner}
    </Link>
  );
}
