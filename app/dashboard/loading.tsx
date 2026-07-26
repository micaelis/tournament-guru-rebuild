/**
 * Route-level skeleton for every dashboard page. Shown instantly on
 * navigation inside the shell (sidebar + header persist) while the
 * server renders the destination — generic title / stat-strip / panel
 * shapes that fit all the role-scoped pages without promising any
 * specific layout.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="space-y-3">
        <div className="h-7 w-52 rounded-lg bg-slate-200/80" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200/60" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl border border-slate-200/60 bg-slate-200/50" />
        <div className="h-24 rounded-2xl border border-slate-200/60 bg-slate-200/50" />
        <div className="h-24 rounded-2xl border border-slate-200/60 bg-slate-200/50" />
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200/60 bg-white p-6">
        <div className="h-5 w-40 rounded bg-slate-200/70" />
        <div className="h-4 w-full rounded bg-slate-200/50" />
        <div className="h-4 w-11/12 rounded bg-slate-200/50" />
        <div className="h-4 w-4/5 rounded bg-slate-200/50" />
        <div className="h-4 w-2/3 rounded bg-slate-200/50" />
      </div>
    </div>
  );
}
