import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * The pill used for the header's primary action. "solid" is the red gradient
 * CTA (public "Sign in"); "outline" reverses the colors — white pill, accent
 * text — for quieter actions like the auth-flow "Browse events". Both share
 * the same geometry + hover lift.
 */
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
  size?: "md" | "sm";
  variant?: "solid" | "outline";
  icon?: ReactNode;
}) {
  const sizeCls =
    size === "sm"
      ? "px-[18px] py-[11px] text-[13.5px]"
      : "px-5 py-2 text-[15px]";
  const variantCls =
    variant === "outline"
      ? "tg-pill-outline text-[var(--color-accent)]"
      : "text-white";
  const variantStyle: React.CSSProperties =
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
  return (
    <Link
      href={href as Route}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-transform hover:-translate-y-0.5 ${variantCls} ${sizeCls}`}
      style={{ ...variantStyle, textDecoration: "none" }}
    >
      {icon}
      {children}
    </Link>
  );
}
