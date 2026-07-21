import { headers } from "next/headers";

const FALLBACK_URL = "http://localhost:3000";

/** Trailing slashes stripped so callers can append paths verbatim. */
function normalize(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * The app's public home URL (the rebuild's answer to Bubble's
 * "Website home URL").
 *
 * Resolution order: explicit `NEXT_PUBLIC_SITE_URL`, then Vercel's
 * production/deployment host, then the live request host, then a
 * localhost default. The env legs return before any request state is
 * touched, so statically rendered callers (the legal pages) stay static
 * whenever the URL is configured; only an unconfigured deployment falls
 * through to `headers()`, which opts the calling route into dynamic
 * rendering.
 */
export async function siteUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return normalize(explicit);

  // Vercel exposes bare hosts (no scheme); production URL first so
  // preview deployments still print the canonical domain.
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;

  try {
    const host = (await headers()).get("host");
    if (host) {
      const scheme = /^(localhost|127\.)/.test(host) ? "http" : "https";
      return `${scheme}://${host}`;
    }
  } catch {
    // No request scope (build-time prerender) — use the default.
  }
  return FALLBACK_URL;
}
