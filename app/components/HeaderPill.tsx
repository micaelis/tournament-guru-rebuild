import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * The pill used for the header's primary action. "solid" is the red gradient
 * CTA (public "Sign in"); "outline" reverses the colors — white pill, accent
 * text — for quieter actions like the auth-flow "Browse events" and the
 * signed-in "Log out". Both share the same geometry + hover lift.
 */
type PillVariant = "solid" | "outline";
type PillSize = "md" | "sm";

/** Shared look so non-Link controls (e.g. the Log out button) can match. */
export function headerPillLook(
  variant: PillVariant = "solid",
  size: PillSize = "md",
): { className: string; style: React.CSSProperties } {
  const sizeCls =
    size === "sm"
      ? "px-[18px] py-[11px] text-[13.5px]"
      : "px-5 py-2 text-[15px]";
  const variantCls =
    variant === "outline"
      ? "tg-pill-outline text-[var(--color-accent)]"
      : "text-white";
  const style: React.CSSProperties =
    variant === "outline"
      ? {
          background: "#fff",
          border: "1px solid rgba(220,38,38,.35)",
          boxShadow: "0 4px 12px -6px rgba(15,23,42,.18)",
        }
      : {
          background:
            "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
          boxShadow: "0 6px 16px -6px rgba(220,38,38,.5)",
        };
  return {
    className: `inline-flex items-center gap-1.5 rounded-full font-semibold transition-transform hover:-translate-y-0.5 ${variantCls} ${sizeCls}`,
    style,
  };
}

export function HeaderPill({
  href,
  children,
  size = "md",
  variant = "solid",
  icon,
}: {
  href: string;
  children: ReactNode;
  /** "sm" — the compact auth-flow "Browse events" pill; "md" — the public CTA. */
  size?: PillSize;
  variant?: PillVariant;
  icon?: ReactNode;
}) {
  const look = headerPillLook(variant, size);
  return (
    <Link
      href={href as Route}
      className={look.className}
      style={{ ...look.style, textDecoration: "none" }}
    >
      {icon}
      {children}
    </Link>
  );
}
