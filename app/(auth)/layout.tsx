import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell for /login, /signup, /reset, /reset/update, and the
 * whole /onboarding wizard. Form column on the left; sticky glass
 * panel on the right that stays in view as the form scrolls on tall
 * screens.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh tg-aurora">
      <div className="mx-auto grid min-h-dvh max-w-[1280px] grid-cols-1 gap-0 md:grid-cols-[minmax(360px,540px)_1fr]">
        <div className="flex flex-col px-6 py-8 md:px-12 md:py-12">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-[15px] font-semibold text-slate-900"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
              TG
            </span>
            <span className="font-[var(--font-heading)]">Tournament Guru</span>
          </Link>
          <div className="flex-1">{children}</div>
          <p className="mt-8 text-xs text-slate-500">
            © {new Date().getFullYear()} Tournament Guru
          </p>
        </div>

        <aside className="relative hidden md:block">
          <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden">
            <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-red-900" />
            <div className="relative m-8 max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">
                Tournament Guru
              </p>
              <h2 className="mt-3 font-[var(--font-heading)] text-3xl font-extrabold leading-tight text-white">
                Welcome to Tournament Guru
              </h2>
              <p className="mt-4 text-sm text-white/80">
                The most comprehensive youth sports tournament search engine.
                Your one-stop shop to find the right event for your team.
              </p>
              <p className="mt-3 text-sm text-white/70">
                Event information and verified reviews from previous attendees,
                to help families, coaches, and managers pick their team's next
                event.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Coaches", "Team Managers", "Parents", "Event Directors"].map(
                  (chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
                    >
                      {chip}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
