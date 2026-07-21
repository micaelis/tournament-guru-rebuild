import Link from "next/link";
import type { Route } from "next";
import { TGLogo } from "./TGLogo";

const COLS = [
  {
    title: "Explore",
    links: [
      { label: "Find events", href: "/events" },
      { label: "Host an event", href: "/host" },
      { label: "Reviews", href: "/reviews" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer style={{ background: "var(--color-dark)", color: "#94a3b8" }}>
      <div
        className="mx-auto max-w-[1280px]"
        style={{ padding: "46px 24px 28px" }}
      >
        {/* Top section */}
        <div className="flex flex-wrap justify-between gap-10">
          {/* Brand */}
          <div style={{ maxWidth: 300 }}>
            <TGLogo href="/" size="lg" variant="light" />
            <p
              className="mt-3.5 mb-0"
              style={{ fontSize: 13.5, lineHeight: 1.6, color: "#94a3b8" }}
            >
              Every tournament, reviewed by the coaches and parents who actually
              showed up.
            </p>
            {/* Social icons */}
            <div className="mt-4.5 flex gap-2.5">
              {SOCIAL_ICONS.map((icon, i) => (
                <a
                  key={i}
                  href={"#" as Route}
                  aria-label={icon.label}
                  className="inline-flex items-center justify-center rounded-full transition-colors hover:text-white"
                  style={{
                    width: 34,
                    height: 34,
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.1)",
                    color: "#cbd5e1",
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {icon.path}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="flex flex-wrap gap-13">
            {COLS.map((col) => (
              <div key={col.title}>
                <div
                  className="mb-3.5 text-[13px] font-bold text-white"
                  style={{ letterSpacing: ".02em" }}
                >
                  {col.title}
                </div>
                <div className="flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <Link
                      key={l.label}
                      href={l.href as Route}
                      className="text-[13px] text-[#94a3b8] no-underline transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-9.5 flex flex-wrap items-center justify-between gap-3 pt-5"
          style={{
            borderTop: "1px solid rgba(255,255,255,.1)",
            fontSize: 12.5,
          }}
        >
          <span>&copy; 2026 Tournament Guru. All rights reserved.</span>
          <div className="flex gap-4.5">
            <Link
              href={"/privacy" as Route}
              className="text-[#94a3b8] no-underline transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href={"/terms" as Route}
              className="text-[#94a3b8] no-underline transition-colors hover:text-white"
            >
              Legal
            </Link>
            <Link
              href={"/cookies" as Route}
              className="text-[#94a3b8] no-underline transition-colors hover:text-white"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

const SOCIAL_ICONS = [
  {
    label: "Website",
    path: (
      <>
        <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
      </>
    ),
  },
  {
    label: "Email",
    path: (
      <>
        <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
      </>
    ),
  },
  {
    label: "Contact",
    path: (
      <>
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </>
    ),
  },
];
