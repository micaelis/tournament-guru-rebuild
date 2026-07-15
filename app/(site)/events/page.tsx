import Link from "next/link";

/**
 * Slice 5 delivers the public search-events surface. Until then this
 * stub is where attendees land after onboarding — the "attendees don't
 * have a /dashboard/events" contract in DECISIONS §S0.8.
 */
export default function EventsStub() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-600">
        Coming soon
      </p>
      <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-extrabold text-slate-900">
        Find events
      </h1>
      <p className="mt-4 max-w-md text-sm text-slate-600">
        Search + map + filters ship in Slice 5. For now you can head to your
        account, or sign back in with a different role.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/dashboard/events"
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
        >
          Go to your dashboard
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
