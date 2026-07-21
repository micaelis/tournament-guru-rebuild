"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  StatusPill,
  EmptyState,
  Table,
  TD,
  cn,
  textLinkClass,
  TH,
  THead,
  TR,
  useToast,
} from "@/app/components/ui";
import { cancelSubmittedCsv } from "./actions";
import { csvFileName, downloadCsvRow } from "./download-csv";
import type { SubmittedCsvRow } from "./queries";

/** ED's submissions — one flat list per spec; status chip carries the
 * state ("Sent emails" replaces the DB's "approved" label). */
export function EdSubmittedList({ rows }: { rows: SubmittedCsvRow[] }) {
  const [confirmCancel, setConfirmCancel] = useState<SubmittedCsvRow | null>(null);
  const { push } = useToast();

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No submissions yet"
        body="Head to the Submit CSV tab to send your first batch to the admin."
      />
    );
  }

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Event</TH>
            <TH>CSV file</TH>
            <TH>Submitted</TH>
            <TH>Status</TH>
            <TH className="w-40">Actions</TH>
          </TR>
        </THead>
        <tbody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD>
                {r.event ? (
                  <Link
                    href={`/dashboard/events/${r.event.id}` as Route}
                    className="font-semibold text-slate-900 hover:text-red-600"
                  >
                    {r.event.title}
                  </Link>
                ) : (
                  <span className="text-slate-400">Event removed</span>
                )}
              </TD>
              <TD>
                <button
                  type="button"
                  onClick={() => void downloadCsvRow(r, (m) => push("error", m))}
                  className={cn(textLinkClass, "inline-flex items-center gap-1 text-sm")}
                >
                  <DownloadGlyph /> {csvFileName(r)}
                </button>
              </TD>
              <TD className="text-xs text-slate-500">
                {formatDate(r.created_at)}
              </TD>
              <TD>
                <StatusPill
                  tone={
                    r.status === "pending"
                      ? "warning"
                      : r.status === "approved"
                        ? "success"
                        : "danger"
                  }
                >
                  {r.status === "approved"
                    ? "Sent emails"
                    : r.status === "pending"
                      ? "Pending"
                      : "Rejected"}
                </StatusPill>
                {r.status === "rejected" && r.rejection_reason && (
                  <p className="mt-1 text-[11px] text-red-700">
                    {r.rejection_reason}
                  </p>
                )}
              </TD>
              <TD>
                {r.status === "pending" && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmCancel(r)}
                  >
                    Cancel
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
      <ConfirmDialog
        open={confirmCancel !== null}
        title="Cancel this submission?"
        body="The pending request will be withdrawn. You can re-upload later."
        confirmLabel="Withdraw"
        onClose={() => setConfirmCancel(null)}
        onConfirm={async () => {
          if (!confirmCancel) return;
          const res = await cancelSubmittedCsv(confirmCancel.id);
          setConfirmCancel(null);
          if (res.error) return push("error", res.error);
          push("success", "Submission canceled.");
        }}
      />
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DownloadGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
