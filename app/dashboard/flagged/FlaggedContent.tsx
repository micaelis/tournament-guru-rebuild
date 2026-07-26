"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
  EmptyState,
} from "@/app/components/ui";
import {
  deleteFlaggedContent,
  dismissFlags,
  type FlaggedState,
} from "./actions";

export type FlaggedGroup = {
  contentType: "review" | "comment";
  contentId: string;
  title: string | null;
  body: string | null;
  published_at: string;
  eventTitle: string | null;
  eventId: string | null;
  eventLogo: string | null;
  author: {
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
  } | null;
  flags: Array<{
    id: string;
    reason: string;
    additional_info: string | null;
    created_at: string;
    flagged_by: string | null;
    flagger: {
      first_name: string | null;
      last_name: string | null;
      profile_photo_url: string | null;
    } | null;
  }>;
};

/**
 * Renders the grouped flagged-content list — one card per reported
 * item with an expandable flags detail table underneath (spec).
 */
export function FlaggedContent({
  groups,
  tab,
}: {
  groups: FlaggedGroup[];
  tab: "reviews" | "comments";
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDismiss, setConfirmDismiss] = useState<FlaggedGroup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FlaggedGroup | null>(null);
  const { push } = useToast();

  if (groups.length === 0) {
    return (
      <EmptyState
        compact
        title={<>No flagged {tab === "reviews" ? "reviews" : "comments"} right now.</>}
      />
    );
  }

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
      {groups.map((g) => (
        <Card key={g.contentId} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                src={g.author?.profile_photo_url}
                name={
                  [g.author?.first_name, g.author?.last_name]
                    .filter(Boolean)
                    .join(" ") || "Reviewer"
                }
                size={36}
              />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {[g.author?.first_name, g.author?.last_name]
                    .filter(Boolean)
                    .join(" ") || "Former member"}
                </p>
                {g.eventTitle && g.eventId && (
                  <Link
                    href={`/events/${g.eventId}` as Route}
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    {g.eventTitle}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold text-red-700">
                {g.flags.length} flag{g.flags.length === 1 ? "" : "s"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => toggle(g.contentId)}>
                {expanded.has(g.contentId) ? "Hide" : "Details"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDismiss(g)}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmDelete(g)}
              >
                Delete
              </Button>
            </div>
          </div>
          {g.title && (
            <p className="mt-3 text-sm font-bold text-slate-900">{g.title}</p>
          )}
          {g.body && (
            <p className="mt-1 line-clamp-3 text-sm text-slate-700">{g.body}</p>
          )}
          {expanded.has(g.contentId) && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Flagged by</TH>
                    <TH>Created</TH>
                    <TH>Reason</TH>
                    <TH>Comment</TH>
                  </TR>
                </THead>
                <tbody>
                  {g.flags.map((f) => (
                    <TR key={f.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={f.flagger?.profile_photo_url}
                            name={
                              [
                                f.flagger?.first_name,
                                f.flagger?.last_name,
                              ]
                                .filter(Boolean)
                                .join(" ") || "Anonymous"
                            }
                            size={26}
                          />
                          <span className="text-sm">
                            {[
                              f.flagger?.first_name,
                              f.flagger?.last_name,
                            ]
                              .filter(Boolean)
                              .join(" ") || "Anonymous"}
                          </span>
                        </div>
                      </TD>
                      <TD className="text-xs text-slate-500">
                        {new Date(f.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TD>
                      <TD className="text-sm">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {f.reason}
                        </span>
                      </TD>
                      <TD className="text-xs text-slate-600">
                        {f.additional_info ?? "—"}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      ))}

      <ConfirmDialog
        open={confirmDismiss !== null}
        destructive={false}
        title="Dismiss the flags on this item?"
        body="The content stays. Flag records are removed so it drops from this list."
        confirmLabel="Dismiss"
        onClose={() => setConfirmDismiss(null)}
        onConfirm={async () => {
          if (!confirmDismiss) return;
          const res: FlaggedState = await dismissFlags(
            confirmDismiss.contentType,
            confirmDismiss.contentId,
          );
          setConfirmDismiss(null);
          if (res.error) return push("error", res.error);
          push("success", "Flags dismissed.");
        }}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Delete this ${confirmDelete?.contentType === "review" ? "review" : "comment"}?`}
        body={
          confirmDelete?.contentType === "review"
            ? "Deletes the review + its comments + every flag record. Aggregate ratings on the parent event will recompute."
            : "Deletes the comment + its flag records. Nested replies cascade."
        }
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const res: FlaggedState = await deleteFlaggedContent(
            confirmDelete.contentType,
            confirmDelete.contentId,
          );
          setConfirmDelete(null);
          if (res.error) return push("error", res.error);
          push("success", "Removed.");
        }}
      />
    </div>
  );
}
