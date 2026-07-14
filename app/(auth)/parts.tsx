import Link from "next/link";
import { TGLogo } from "../components/TGLogo";

/** Logo (left) + a contextual link (right) — sits above every auth form. */
export function AuthTopBar({
  rightLabel,
  rightHref,
}: {
  rightLabel: string;
  rightHref: string;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginBottom: 40 }}
    >
      <TGLogo href="/" size="sm" />
      <Link
        href={rightHref}
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          textDecoration: "none",
        }}
      >
        {rightLabel}
      </Link>
    </div>
  );
}

/** Page title + subtitle in the display type treatment. */
export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1
        className="font-heading text-dark"
        style={{
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

