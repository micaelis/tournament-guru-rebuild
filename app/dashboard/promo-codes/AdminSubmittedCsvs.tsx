"use client";

import type { SubmittedCsvRow } from "./queries";

/**
 * Admin's Submitted CSVs table stub — the subtabs, reject flow, and
 * send-emails popup are wired in S3.2. This client component exists
 * now so the tab renders with a real component boundary while S3.1
 * lays the data plumbing.
 */
export function AdminSubmittedCsvs({ rows }: { rows: SubmittedCsvRow[] }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
      Admin queue lands in S3.2 — {rows.length} submission
      {rows.length === 1 ? "" : "s"} in flight.
    </div>
  );
}
