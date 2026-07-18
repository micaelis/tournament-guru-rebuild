"use client";

import { useState } from "react";
import { StatusPill, Table, TD, TH, THead, TR } from "@/app/components/ui";

export type SupportMessageRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
  user_type: string | null;
  role_title: string | null;
};

function roleLabel(userType: string | null, roleTitle: string | null): string {
  if (!userType) return "Unknown";
  const type = userType === "event_director" ? "ED" : userType === "attendee" ? "Attendee" : "Admin";
  return roleTitle ? `${type} · ${roleTitle}` : type;
}

export function SupportMessagesTable({ rows }: { rows: SupportMessageRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  return (
    <Table>
      <THead>
        <TH>Sender</TH>
        <TH>Message</TH>
        <TH>Type / Role</TH>
        <TH>Date</TH>
      </THead>
      <tbody>
        {rows.map((r) => {
          const isExpanded = expanded.has(r.id);
          const longMessage = r.message.length > 120;
          return (
            <TR key={r.id}>
              <TD>
                <div className="text-sm font-medium text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-500">{r.email}</div>
              </TD>
              <TD>
                <div className="max-w-md text-sm text-slate-700">
                  {isExpanded || !longMessage
                    ? r.message
                    : r.message.slice(0, 120) + "…"}
                  {longMessage && (
                    <button
                      type="button"
                      className="ml-1 text-xs font-medium text-blue-600 hover:underline"
                      onClick={() => {
                        const next = new Set(expanded);
                        if (isExpanded) next.delete(r.id);
                        else next.add(r.id);
                        setExpanded(next);
                      }}
                    >
                      {isExpanded ? "less" : "more"}
                    </button>
                  )}
                </div>
              </TD>
              <TD>
                <StatusPill tone={r.user_type === "event_director" ? "info" : "muted"}>
                  {roleLabel(r.user_type, r.role_title)}
                </StatusPill>
              </TD>
              <TD>
                <span className="whitespace-nowrap text-sm text-slate-500">
                  {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}
