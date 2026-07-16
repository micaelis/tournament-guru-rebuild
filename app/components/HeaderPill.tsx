import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * The red gradient pill used for the header's primary action. Shared so the
 * public "Sign in" CTA and the auth-flow "Browse events" CTA are guaranteed
 * to have identical styling + hover lift.
 */
export function HeaderPill({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className="rounded-full px-5 py-2 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
        boxShadow: "0 6px 16px -6px rgba(220,38,38,.5)",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
