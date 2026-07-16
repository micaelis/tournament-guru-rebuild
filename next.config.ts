import type { NextConfig } from "next";

/**
 * Security response headers applied to every route. Kept intentionally
 * conservative — no strict Content-Security-Policy yet because the app
 * uses several inline <style> blocks and inline event handlers that a
 * strict CSP would break; introducing CSP is a separate follow-up.
 *
 * Headers picked here are the ones with zero-risk-of-breakage:
 *   • Strict-Transport-Security  — force HTTPS on future visits
 *   • X-Frame-Options            — prevent clickjacking via iframe embed
 *   • X-Content-Type-Options     — stop MIME-sniffing
 *   • Referrer-Policy            — avoid leaking full URLs to third-parties
 *   • Permissions-Policy         — deny sensor + payment APIs we don't use
 *   • Cross-Origin-Opener-Policy — isolate window from cross-origin popups
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets the Playwright E2E build/serve into its own dir (NEXT_DIST_DIR=
  // .next-e2e) so it never clashes with a running `next dev` on `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tournamentguru.s3.us-east-2.amazonaws.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
