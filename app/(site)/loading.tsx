/**
 * Route-level skeleton for the public site. Header + footer persist
 * (they live in the group layout); the content area shows a neutral
 * heading + card-grid shimmer while the destination renders — shaped
 * for the discovery pages (events, reviews) where server work is
 * heaviest, generic enough for the rest.
 */
export default function SiteLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse px-6 py-12"
      aria-hidden="true"
    >
      <div className="space-y-3">
        <div className="h-8 w-72 max-w-full rounded-lg bg-slate-200/80" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-200/60" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-56 rounded-2xl border border-slate-200/60 bg-slate-200/50"
          />
        ))}
      </div>
    </div>
  );
}
