import Link from "next/link";
import type { Route } from "next";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * The canonical inline text-link treatment (the signup page's "browse
 * events" link): slate with a soft slate underline, warming to the
 * accent on hover. Font-size is inherited so the link sits in any copy
 * scale. Entity-title links in tables/cards keep their own pattern
 * (bold slate-900, hover accent, no underline at rest) — this is for
 * links that live inside or alongside body text.
 */
export const textLinkClass =
  "font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-[var(--color-accent)] hover:decoration-[var(--color-accent)]";

export function TextLink({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  // Scheme-prefixed destinations (http:, mailto:, tel:) render as plain
  // anchors; in-app routes get client-side navigation via next/link.
  const external = /^[a-z][a-z0-9+.-]*:/i.test(href);
  if (external) {
    return (
      <a href={href} className={cn(textLinkClass, className)} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href as Route}
      className={cn(textLinkClass, className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
