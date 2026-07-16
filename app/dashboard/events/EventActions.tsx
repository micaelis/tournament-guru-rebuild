"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  ConfirmDialog,
  useToast,
} from "@/app/components/ui";
import { CANCEL_REASON_MAX } from "@/lib/enums";
import {
  cancelEvent,
  deleteEvent,
  duplicateEvent,
} from "./event-actions";

/**
 * Action bar for one event: Edit / Duplicate / Copy link / Upgrade
 * plus the destructive Cancel + Delete (behind confirmation modals).
 * Callers pass `canManage` — attendees never see this, and admins are
 * only shown Delete + Edit when they own (or created) the event.
 */
export function EventActions({
  eventId,
  eventTitle,
  lifecycle,
  isPremium,
  canManage,
  isAdmin = false,
  onUpgradeClick,
}: {
  eventId: string;
  eventTitle: string;
  lifecycle: "draft" | "active" | "canceled";
  isPremium: boolean;
  canManage: boolean;
  isAdmin?: boolean;
  onUpgradeClick?: () => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          router.push(`/dashboard/events/${eventId}/edit` as never)
        }
      >
        Edit
      </Button>
      {canManage && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            startTransition(async () => {
              const res = await duplicateEvent(eventId);
              if (res.error) push("error", res.error);
            })
          }
        >
          Duplicate
        </Button>
      )}
      <CopyLinkButton eventId={eventId} />
      {canManage && !isPremium && (
        <Button size="sm" onClick={onUpgradeClick}>
          ★ Upgrade
        </Button>
      )}
      {canManage && lifecycle === "active" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmCancel(true)}
        >
          Cancel event
        </Button>
      )}
      {isAdmin && (
        <Button size="sm" variant="ghost" onClick={() => setQrOpen(true)}>
          QR
        </Button>
      )}
      {canManage && (
        <Button
          size="sm"
          variant="danger"
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${eventTitle}"?`}
        body="This action is permanent. Reviews attached to this event stay in the database as detached snapshots — historical context is preserved."
        confirmLabel="Delete event"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteEvent(eventId);
          setConfirmDelete(false);
          if (res.error) return push("error", res.error);
          push("success", "Event deleted.");
          router.refresh();
        }}
      />

      <CancelEventDialog
        open={confirmCancel}
        eventId={eventId}
        onClose={() => setConfirmCancel(false)}
      />

      {isAdmin && (
        <QRDialog
          open={qrOpen}
          eventId={eventId}
          eventTitle={eventTitle}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * QR modal. Fetches the 400×400 PNG from the qr route and shows it in
 * the dialog with Download PNG / PDF buttons. Spec confirms 400×400 +
 * PNG + PDF variants and requires a "confirming the QR image has been
 * downloaded" alert — the browser's own download UI covers that.
 */
function QRDialog({
  open,
  eventId,
  eventTitle,
  onClose,
}: {
  open: boolean;
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}) {
  const { push } = useToast();
  if (!open) return null;
  const pngHref = `/dashboard/events/qr/${eventId}?format=png`;
  const pdfHref = `/dashboard/events/qr/${eventId}?format=pdf`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          QR — {eventTitle}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Encodes the event&apos;s public URL. Print or share.
        </p>
        <div className="mt-4 flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <img
            src={pngHref}
            width={280}
            height={280}
            alt="Event QR code"
            className="h-[280px] w-[280px] rounded-xl bg-white"
          />
        </div>
        <div className="mt-5 flex justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <a href={pngHref} download onClick={() => push("success", "QR PNG downloaded.")}>
              <Button variant="ghost">Download PNG</Button>
            </a>
            <a href={pdfHref} download onClick={() => push("success", "QR PDF downloaded.")}>
              <Button>Download PDF</Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Client copy-link → clipboard + confirmation toast. */
function CopyLinkButton({ eventId }: { eventId: string }) {
  const { push } = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        const url = `${window.location.origin}/events/${eventId}`;
        try {
          await navigator.clipboard.writeText(url);
          push("success", "Public link copied to clipboard.");
        } catch {
          push("error", "Couldn't copy — check your browser permissions.");
        }
      }}
    >
      Copy link
    </Button>
  );
}

/**
 * Cancel-event modal. Reason is mandatory + capped; the value flows to
 * the public event details page. Kept as a small component so the row
 * layer doesn't own the cancel state.
 */
function CancelEventDialog({
  open,
  eventId,
  onClose,
}: {
  open: boolean;
  eventId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const { push } = useToast();
  const router = useRouter();
  if (!open) return null;
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
        <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          Cancel event?
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Attendees will see this reason on the event&apos;s public page.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Why is this event being canceled?
          </span>
          <textarea
            rows={4}
            maxLength={CANCEL_REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="tg-control resize-none"
            placeholder="Weather, permits, low registration…"
          />
          <span className="mt-1 block text-right text-[11px] text-slate-500">
            {reason.length}/{CANCEL_REASON_MAX}
          </span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Keep event
          </Button>
          <Button
            variant="danger"
            disabled={pending || !reason.trim()}
            onClick={async () => {
              setPending(true);
              const res = await cancelEvent(eventId, reason);
              setPending(false);
              if (res.error) return push("error", res.error);
              if (res.fieldErrors?.cancel_reason) {
                return push("error", res.fieldErrors.cancel_reason);
              }
              push("success", "Event canceled.");
              onClose();
              router.refresh();
            }}
          >
            {pending ? "Canceling…" : "Cancel event"}
          </Button>
        </div>
      </div>
    </div>
  );
}
