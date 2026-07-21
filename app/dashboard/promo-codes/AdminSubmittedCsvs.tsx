"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  StatusPill,
  Table,
  TD,
  cn,
  textLinkClass,
  TH,
  THead,
  TR,
  useToast,
} from "@/app/components/ui";
import { rejectSubmittedCsv } from "./actions";
import { downloadCsvRow } from "./download-csv";
import { SendEmailsDialog } from "./SendEmailsDialog";
import type { SubmittedCsvRow } from "./queries";

type SubTab = "all" | "pending" | "sent" | "rejected";

/**
 * Admin queue. Subtabs filter by status; each row has the ED info,
 * event, CSV download, submission date, and either the pending
 * action pair (Reject / Send Emails) or the sent/rejected status
 * with a Resend option once the promo generation flow lands.
 */
export function AdminSubmittedCsvs({ rows }: { rows: SubmittedCsvRow[] }) {
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [rejecting, setRejecting] = useState<SubmittedCsvRow | null>(null);
  const [sending, setSending] = useState<SubmittedCsvRow | null>(null);
  const { push } = useToast();

  const filtered = useMemo(() => {
    if (subTab === "all") return rows;
    if (subTab === "sent") return rows.filter((r) => r.status === "approved");
    if (subTab === "rejected") return rows.filter((r) => r.status === "rejected");
    return rows.filter((r) => r.status === "pending");
  }, [rows, subTab]);

  const counts: Record<SubTab, number> = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    sent: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "sent", label: "Sent Promo Code" },
            { key: "rejected", label: "Rejected" },
          ] as const
        ).map((t) => {
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {t.label} · {counts[t.key]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No submissions in this bucket.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Event Director</TH>
              <TH>Event</TH>
              <TH>CSV file</TH>
              <TH>Submitted</TH>
              <TH>Status</TH>
              <TH className="w-52">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {filtered.map((r) => (
              <AdminRow
                key={r.id}
                row={r}
                onReject={() => setRejecting(r)}
                onSendEmails={() => setSending(r)}
              />
            ))}
          </tbody>
        </Table>
      )}

      {rejecting && (
        <RejectDialog
          row={rejecting}
          onClose={() => setRejecting(null)}
        />
      )}
      {sending && (
        <SendEmailsDialog
          row={sending}
          onClose={() => setSending(null)}
          onSuccess={() => {
            push("success", "Emails queued.");
            setSending(null);
          }}
        />
      )}
    </div>
  );
}

function AdminRow({
  row,
  onReject,
  onSendEmails,
}: {
  row: SubmittedCsvRow;
  onReject: () => void;
  onSendEmails: () => void;
}) {
  const { push } = useToast();
  const edName =
    [row.ed?.first_name, row.ed?.last_name].filter(Boolean).join(" ") ||
    "Event Director";
  return (
    <TR className={row.status === "rejected" ? "opacity-60" : undefined}>
      <TD>
        <div className="flex items-center gap-2">
          <Avatar
            src={row.ed?.profile_photo_url}
            name={edName}
            size={32}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{edName}</p>
            {row.ed?.organization_title && (
              <p className="truncate text-[11px] text-slate-500">
                {row.ed.organization_title}
              </p>
            )}
          </div>
        </div>
      </TD>
      <TD>
        {row.event ? (
          <Link
            href={`/dashboard/events/${row.event.id}` as Route}
            className="font-semibold text-slate-900 hover:text-red-600"
          >
            {row.event.title}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </TD>
      <TD>
        <button
          type="button"
          onClick={() => void downloadCsvRow(row, (m) => push("error", m))}
          className={cn(textLinkClass, "text-sm")}
        >
          {row.raw_emails.length} emails.csv
        </button>
      </TD>
      <TD className="text-xs text-slate-500">
        {formatDate(row.created_at)}
      </TD>
      <TD>
        <StatusPill
          tone={
            row.status === "pending"
              ? "warning"
              : row.status === "approved"
                ? "success"
                : "danger"
          }
        >
          {row.status === "approved"
            ? "Sent Promo Code"
            : row.status === "pending"
              ? "Pending"
              : "Rejected"}
        </StatusPill>
        {row.status === "rejected" && row.rejection_reason && (
          <p className="mt-1 max-w-[220px] text-[11px] text-red-700">
            {row.rejection_reason}
          </p>
        )}
      </TD>
      <TD>
        {row.status === "pending" && (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="danger" onClick={onReject}>
              Reject
            </Button>
            <Button size="sm" onClick={onSendEmails}>
              Send Emails
            </Button>
          </div>
        )}
        {row.status === "approved" && (
          <Button size="sm" variant="ghost" onClick={onSendEmails}>
            Resend
          </Button>
        )}
      </TD>
    </TR>
  );
}

function RejectDialog({
  row,
  onClose,
}: {
  row: SubmittedCsvRow;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const { push } = useToast();
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          Reject this CSV?
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          The ED will see your reason on their dashboard.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Reason
          </span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="tg-control resize-none"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={pending}
            disabled={!reason.trim()}
            onClick={async () => {
              setPending(true);
              const res = await rejectSubmittedCsv(row.id, reason);
              setPending(false);
              if (res.error) return push("error", res.error);
              if (res.fieldErrors?.reason) return push("error", res.fieldErrors.reason);
              push("success", "Submission rejected.");
              onClose();
            }}
          >
            {pending ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </div>
    </div>
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
