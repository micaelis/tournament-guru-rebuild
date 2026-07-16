import type { ReactNode } from "react";

/**
 * The auth group no longer owns the two-column chrome — each page wraps
 * its own content in <AuthShell> so it can pick the right-panel variant
 * (e.g. signup's ED-claim copy). This layout is a thin pass-through.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
