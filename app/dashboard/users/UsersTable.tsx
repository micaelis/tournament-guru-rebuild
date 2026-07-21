"use client";

import { useState } from "react";
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
  EmptyState,
} from "@/app/components/ui";
import { deleteUser, setBlocked } from "./actions";

export type UserRow = {
  id: string;
  user_type: "attendee" | "event_director" | "admin";
  role_title: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  user_gender: string | null;
  location_formatted: string | null;
  organization_title: string | null;
  profile_photo_url: string | null;
  created_at: string;
  blocked: boolean;
};

/**
 * Users table. Columns differ per tab — attendees show location /
 * gender / DOB / joined / type / reviews; EDs show org title /
 * joined / type / total events / premium events. Action buttons:
 * Block / Unblock + Delete with confirm.
 */
export function UsersTable({
  rows,
  counts,
  tab,
}: {
  rows: UserRow[];
  counts: Map<string, { reviews: number; events: number; premium: number }>;
  tab: "attendees" | "eds";
}) {
  const [confirmBlock, setConfirmBlock] = useState<UserRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const { push } = useToast();

  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        title={<>No {tab === "attendees" ? "attendees" : "event directors"} yet.</>}
      />
    );
  }

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            {tab === "attendees" ? (
              <>
                <TH>Location</TH>
                <TH>Gender</TH>
                <TH>DOB</TH>
              </>
            ) : (
              <TH>Organization</TH>
            )}
            <TH>Joined</TH>
            <TH>Role</TH>
            {tab === "attendees" ? (
              <TH>Reviews</TH>
            ) : (
              <>
                <TH>Events</TH>
                <TH>Premium</TH>
              </>
            )}
            <TH className="w-40">Actions</TH>
          </TR>
        </THead>
        <tbody>
          {rows.map((r) => {
            const c = counts.get(r.id) ?? { reviews: 0, events: 0, premium: 0 };
            const name =
              [r.first_name, r.last_name].filter(Boolean).join(" ") ||
              (r.blocked ? "Former member" : "User");
            return (
              <TR
                key={r.id}
                className={r.blocked ? "opacity-60" : undefined}
              >
                <TD>
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={r.profile_photo_url}
                      name={name}
                      size={32}
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{name}</p>
                      {r.blocked && (
                        <StatusPill tone="danger">Blocked</StatusPill>
                      )}
                    </div>
                  </div>
                </TD>
                {tab === "attendees" ? (
                  <>
                    <TD className="text-xs text-slate-500">
                      {r.location_formatted ?? "—"}
                    </TD>
                    <TD className="text-xs text-slate-500">
                      {r.user_gender ?? "—"}
                    </TD>
                    <TD className="text-xs text-slate-500">
                      {r.dob ?? "—"}
                    </TD>
                  </>
                ) : (
                  <TD className="text-sm text-slate-800">
                    {r.organization_title ?? "—"}
                  </TD>
                )}
                <TD className="text-xs text-slate-500">
                  {formatDate(r.created_at)}
                </TD>
                <TD className="text-xs text-slate-500">
                  {r.role_title}
                </TD>
                {tab === "attendees" ? (
                  <TD className="text-sm font-bold text-slate-800">
                    {c.reviews}
                  </TD>
                ) : (
                  <>
                    <TD className="text-sm font-bold text-slate-800">
                      {c.events}
                    </TD>
                    <TD className="text-sm font-bold text-slate-800">
                      {c.premium}
                    </TD>
                  </>
                )}
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmBlock(r)}
                    >
                      {r.blocked ? "Unblock" : "Block"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmDelete(r)}
                    >
                      Delete
                    </Button>
                  </div>
                </TD>
              </TR>
            );
          })}
        </tbody>
      </Table>

      <ConfirmDialog
        open={confirmBlock !== null}
        destructive={confirmBlock ? !confirmBlock.blocked : true}
        title={
          confirmBlock?.blocked ? "Unblock this user?" : "Block this user?"
        }
        body={
          confirmBlock?.blocked
            ? "They'll be able to sign in and use their account again."
            : "They'll be signed out on their next request and won't be able to sign back in."
        }
        confirmLabel={confirmBlock?.blocked ? "Unblock" : "Block"}
        onClose={() => setConfirmBlock(null)}
        onConfirm={async () => {
          if (!confirmBlock) return;
          const res = await setBlocked(confirmBlock.id, !confirmBlock.blocked);
          setConfirmBlock(null);
          if (res.error) return push("error", res.error);
          push(
            "success",
            confirmBlock.blocked ? "User unblocked." : "User blocked.",
          );
        }}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this user?"
        body="Their reviews + comments stay as 'Former member'. ED-owned tournaments/events created by them are removed; claimed-only events revert to the admin."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const res = await deleteUser(confirmDelete.id);
          setConfirmDelete(null);
          if (res.error) return push("error", res.error);
          push("success", "User deleted.");
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
