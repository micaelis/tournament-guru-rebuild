"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  Avatar,
  StatusPill,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
  EmptyState,
} from "@/app/components/ui";
import type { PromoCoachRow } from "./queries";

/**
 * The Coaches with promo codes table. Same shape for ED + Admin;
 * admin gets an extra "From" column showing which ED submitted the
 * CSV. Registered / Invited pill comes from whether a user_id is
 * attached — set at the promo landing step when the coach lands.
 */
export function CoachesList({
  rows,
  isAdmin,
  edNames,
}: {
  rows: PromoCoachRow[];
  isAdmin: boolean;
  edNames: Map<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState compact title="No promo codes on file yet." />
    );
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>Coach</TH>
          {isAdmin && <TH>From</TH>}
          <TH>Event</TH>
          <TH>Account</TH>
          <TH>Promo Code</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <tbody>
        {rows.map((r) => {
          const coachName =
            [r.coach?.first_name, r.coach?.last_name].filter(Boolean).join(" ") ||
            (r.user_id ? "Coach" : r.email);
          const registered = r.user_id !== null;
          const edName =
            (r.submitted_csv?.ed_id
              ? edNames.get(r.submitted_csv.ed_id)
              : null) ?? "Unknown";
          return (
            <TR key={r.id}>
              <TD>
                <div className="flex items-center gap-2">
                  {registered ? (
                    <Avatar
                      src={r.coach?.profile_photo_url}
                      name={coachName}
                      size={32}
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                      ?
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{coachName}</p>
                    <p className="text-[11px] text-slate-500">{r.email}</p>
                  </div>
                </div>
              </TD>
              {isAdmin && (
                <TD className="text-sm text-slate-800">{edName}</TD>
              )}
              <TD>
                {r.event ? (
                  <Link
                    href={`/events/${r.event.id}` as Route}
                    className="font-semibold text-slate-900 hover:text-red-600"
                  >
                    {r.event.title}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TD>
              <TD>
                <StatusPill tone={registered ? "success" : "info"}>
                  {registered ? "Registered" : "Invited"}
                </StatusPill>
              </TD>
              <TD>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[12px] font-bold text-slate-800">
                  {r.pretty_code}
                </span>
              </TD>
              <TD>
                <StatusPill
                  tone={
                    r.status === "applied"
                      ? "success"
                      : r.status === "active"
                        ? "info"
                        : r.status === "sent"
                          ? "warning"
                          : "muted"
                  }
                >
                  {r.status[0].toUpperCase() + r.status.slice(1)}
                </StatusPill>
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Attendee tab — my promo codes list. Compact; no "From" or coach
 * column since the caller IS the coach. */
export function AttendeePromoList({ rows }: { rows: PromoCoachRow[] }) {
  const { push } = useToast();
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No promo codes yet"
        body="You don't have any promo codes on your account yet. Event directors send them by email once their premium event is approved."
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div className="min-w-0">
            {r.event ? (
              <Link
                href={`/events/${r.event.id}` as Route}
                className="text-[15px] font-bold text-slate-900 hover:text-red-600"
              >
                {r.event.title}
              </Link>
            ) : (
              <p className="text-[15px] font-bold text-slate-900">Event</p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">Promo received {formatDate(r.created_at)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(r.pretty_code);
                push("success", "Promo code copied.");
              }}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[12px] font-bold text-slate-800 hover:border-slate-400"
              title="Copy code"
            >
              {r.pretty_code}
            </button>
            <StatusPill
              tone={
                r.status === "applied"
                  ? "success"
                  : r.status === "active"
                    ? "info"
                    : r.status === "sent"
                      ? "warning"
                      : "muted"
              }
            >
              {r.status[0].toUpperCase() + r.status.slice(1)}
            </StatusPill>
            {r.status !== "applied" && r.event && (
              <Link
                href={
                  `/events/${r.event.id}/review?promo=${r.id}` as Route
                }
                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
              >
                Write review
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
