"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  ConfirmDialog,
  StatusPill,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@/app/components/ui";
import {
  approveClaimRequest,
  declineClaimRequest,
} from "@/lib/claims/actions";
import type { ClaimRequestRow } from "@/lib/claims/queries";
import { safeExternalUrl } from "@/lib/url";

type FilterStatus = "all" | "pending" | "approved" | "declined";

/**
 * Claim requests list. Filter + search live in local state; each row
 * expands to reveal the phone / links / message / decline reason
 * per spec ("The request card is expandable and reveals a section
 * below…"). Admin gets Approve + Decline (with reason modal); ED
 * sees status + decline reason.
 */
export function ClaimRequestsTable({
  rows,
  isAdmin,
}: {
  rows: ClaimRequestRow[];
  isAdmin: boolean;
}) {
  const [status, setStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState<ClaimRequestRow | null>(null);
  const [declining, setDeclining] = useState<ClaimRequestRow | null>(null);
  const { push } = useToast();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q) {
        const eventTitle = r.event?.title?.toLowerCase() ?? "";
        const orgTitle = r.requester?.organization_title?.toLowerCase() ?? "";
        if (!eventTitle.includes(q) && !orgTitle.includes(q)) return false;
      }
      return true;
    });
  }, [rows, status, search]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by event or organization…"
          aria-label="Search claim requests"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="tg-control min-w-[240px] flex-1"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FilterStatus)}
          aria-label="Filter by status"
          className="tg-control tg-select w-auto min-w-[180px]"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No claim requests match the current filters.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              {isAdmin && <TH>User</TH>}
              <TH>Event</TH>
              <TH>Created</TH>
              <TH>Status</TH>
              <TH className="w-52">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {filtered.map((r) => (
              <ClaimRow
                key={r.id}
                row={r}
                isAdmin={isAdmin}
                expanded={expanded.has(r.id)}
                onToggle={() => toggle(r.id)}
                onApprove={() => setApproving(r)}
                onDecline={() => setDeclining(r)}
              />
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={approving !== null}
        destructive={false}
        title="Approve this claim?"
        body="Ownership of the tournament + every event under it moves to this ED. Sibling pending claims are auto-declined."
        confirmLabel="Approve claim"
        onClose={() => setApproving(null)}
        onConfirm={async () => {
          if (!approving) return;
          const res = await approveClaimRequest(approving.id);
          setApproving(null);
          if (res.error) return push("error", res.error);
          push("success", "Claim approved. Ownership transferred.");
        }}
      />

      {declining && (
        <DeclineDialog
          row={declining}
          onClose={() => setDeclining(null)}
          onDone={() => setDeclining(null)}
        />
      )}
    </div>
  );
}

function ClaimRow({
  row,
  isAdmin,
  expanded,
  onToggle,
  onApprove,
  onDecline,
}: {
  row: ClaimRequestRow;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const requesterName =
    [row.requester?.first_name, row.requester?.last_name]
      .filter(Boolean)
      .join(" ") || "Event Director";
  return (
    <>
      <TR>
        {isAdmin && (
          <TD>
            <div className="flex items-center gap-2">
              <Avatar
                src={row.requester?.profile_photo_url}
                name={requesterName}
                size={32}
              />
              <div>
                <p className="text-sm font-bold text-slate-900">{requesterName}</p>
                {row.requester?.organization_title && (
                  <p className="text-[11px] text-slate-500">
                    {row.requester.organization_title}
                  </p>
                )}
              </div>
            </div>
          </TD>
        )}
        <TD>
          {row.event ? (
            <Link
              href={`/events/${row.event.id}` as Route}
              className="font-semibold text-slate-900 hover:text-red-600"
            >
              {row.event.title}
            </Link>
          ) : row.tournament ? (
            <span className="text-sm text-slate-800">{row.tournament.title}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </TD>
        <TD className="text-xs text-slate-500">{formatDate(row.created_at)}</TD>
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
            {row.status[0].toUpperCase() + row.status.slice(1)}
          </StatusPill>
        </TD>
        <TD>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={onToggle}>
              {expanded ? "Hide" : "Details"}
            </Button>
            {isAdmin && row.status === "pending" && (
              <>
                <Button size="sm" disabled title="Approve is temporarily parked">
                  Approve
                </Button>
                <Button size="sm" variant="danger" onClick={onDecline}>
                  Decline
                </Button>
              </>
            )}
          </div>
        </TD>
      </TR>
      {expanded && (
        <TR>
          <TD colSpan={isAdmin ? 5 : 4} className="bg-slate-50/60">
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-4 md:grid-cols-2">
              <ReadOnly label="Phone" value={row.phone} />
              <ReadOnly
                label="Links"
                value={
                  row.links.length ? (
                    <ul className="space-y-1">
                      {row.links.map((l) => {
                        const safe = safeExternalUrl(l);
                        return (
                          <li key={l}>
                            {safe ? (
                              <a
                                href={safe}
                                target="_blank"
                                rel="noreferrer nofollow"
                                className="text-red-600 underline"
                              >
                                {l}
                              </a>
                            ) : (
                              <span className="text-slate-500">{l}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    "—"
                  )
                }
              />
              <ReadOnly label="Message" value={row.message ?? "—"} />
              {row.decline_reason && (
                <ReadOnly
                  label="Decline reason"
                  value={row.decline_reason}
                />
              )}
            </div>
          </TD>
        </TR>
      )}
    </>
  );
}

function ReadOnly({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-800">{value}</div>
    </div>
  );
}

function DeclineDialog({
  row,
  onClose,
  onDone,
}: {
  row: ClaimRequestRow;
  onClose: () => void;
  onDone: () => void;
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
          Decline this claim?
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          The reason will be visible to the requesting ED.
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
            disabled={pending || !reason.trim()}
            onClick={async () => {
              setPending(true);
              const res = await declineClaimRequest(row.id, reason);
              setPending(false);
              if (res.error) return push("error", res.error);
              push("success", "Claim declined.");
              onDone();
            }}
          >
            {pending ? "Declining…" : "Decline"}
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
