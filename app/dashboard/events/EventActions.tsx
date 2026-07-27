"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, ConfirmDialog, cn, useToast } from "@/app/components/ui";
import { Icon } from "@/app/dashboard/icons";
import { CANCEL_REASON_MAX } from "@/lib/enums";
import {
  cancelEvent,
  deleteEvent,
  duplicateEvent,
  upgradeEvent,
} from "./event-actions";

/**
 * One sentence, shared by every delete-event confirm (row bar + details
 * page) so the review-retention explanation can't drift between them.
 */
export const DELETE_EVENT_DIALOG_BODY =
  "This action is permanent. Deleting this event won't remove the reviews people wrote for it — they're kept and stay visible on the reviewers' profiles.";

/** Same single-source rule for the upgrade confirm (row + details page). */
export const UPGRADE_EVENT_DIALOG_BODY =
  "We'll unlock video, extra images, roster + registration URLs, and the full feature list. Payments aren't wired yet — the client will manage premium on-behalf while the app launches, so this is a free flip for now.";

const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2.5 rounded-[9px] px-[11px] py-[9px] text-left text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900";
const MENU_ITEM_DANGER_CLASS =
  "flex w-full items-center gap-2.5 rounded-[9px] px-[11px] py-[9px] text-left text-[13px] font-semibold text-red-700 transition-colors hover:bg-red-50";

/**
 * The row action pack: fixed order Upgrade → Edit → "…" so Edit and the
 * overflow hold the same position on every row. Upgrade (solid accent
 * red) appears only on non-premium draft/upcoming/ongoing events —
 * concluded has nothing left to promote, canceled is read-only. Edit
 * covers every status except Canceled (concluded events stay editable).
 * Everything else lives in the overflow menu, adapted per status; all
 * items wire to the same server actions and dialogs the details page
 * uses. QR items are admin-only because the qr route itself rejects
 * non-admins — the affordance mirrors the gate, it doesn't replace it.
 */
export function EventActions({
  eventId,
  eventTitle,
  status,
  isPremium,
  canManage,
  isAdmin = false,
}: {
  eventId: string;
  eventTitle: string;
  status: "Draft" | "Upcoming" | "Ongoing" | "Concluded" | "Canceled";
  isPremium: boolean;
  canManage: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const isDraft = status === "Draft";
  const isCanceled = status === "Canceled";
  const isLive = status === "Upcoming" || status === "Ongoing";
  const showUpgrade = canManage && !isPremium && (isDraft || isLive);

  async function copyToClipboard(url: string, confirmation: string) {
    try {
      await navigator.clipboard.writeText(url);
      push("success", confirmation);
    } catch {
      push("error", "Couldn't copy — check your browser permissions.");
    }
  }

  return (
    <>
      {showUpgrade && (
        <Button
          variant="accent"
          size="xs"
          onClick={() => setConfirmUpgrade(true)}
        >
          <Icon name="spark" className="h-3 w-3" />
          Upgrade
        </Button>
      )}
      {!isCanceled && (
        <Button
          variant="soft"
          size="xs"
          onClick={() => router.push(`/dashboard/events/${eventId}/edit` as never)}
        >
          <Icon name="edit" className="h-3 w-3" />
          Edit
        </Button>
      )}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`More actions for ${eventTitle}`}
          onClick={() => {
            if (!menuOpen) {
              // Flip upward when the panel would fall below the viewport
              // (last rows of a long card must never clip their menu).
              const rect = menuRef.current?.getBoundingClientRect();
              setMenuUp(
                rect != null && window.innerHeight - rect.bottom < 320,
              );
            }
            setMenuOpen((o) => !o);
          }}
          className={cn(
            "grid h-[26px] w-[30px] place-items-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
            menuOpen && "bg-slate-200 text-slate-900",
          )}
        >
          <Icon name="dots" className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className={cn(
              "absolute right-0 z-50 w-[244px] rounded-[14px] border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,.25)]",
              menuUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
            )}
          >
            {canManage && (
              <button
                type="button"
                role="menuitem"
                className={MENU_ITEM_CLASS}
                onClick={() => {
                  setMenuOpen(false);
                  startTransition(async () => {
                    const res = await duplicateEvent(eventId);
                    if (res?.error) push("error", res.error);
                  });
                }}
              >
                <Icon name="copy" className="h-[15px] w-[15px] text-slate-400" />
                Duplicate
              </button>
            )}
            {!isDraft && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={MENU_ITEM_CLASS}
                  onClick={() => {
                    setMenuOpen(false);
                    void copyToClipboard(
                      `${window.location.origin}/events/${eventId}`,
                      "Public link copied to clipboard.",
                    );
                  }}
                >
                  <Icon
                    name="link"
                    className="h-[15px] w-[15px] text-slate-400"
                  />
                  Copy public link
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={MENU_ITEM_CLASS}
                  onClick={() => {
                    setMenuOpen(false);
                    void copyToClipboard(
                      `${window.location.origin}/events/${eventId}/review`,
                      "Spectator reviews link copied to clipboard.",
                    );
                  }}
                >
                  <Icon
                    name="star"
                    className="h-[15px] w-[15px] text-slate-400"
                  />
                  Copy spectator reviews link
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM_CLASS}
                    onClick={() => {
                      setMenuOpen(false);
                      setQrOpen(true);
                    }}
                  >
                    <Icon
                      name="qr"
                      className="h-[15px] w-[15px] text-slate-400"
                    />
                    View QR code
                  </button>
                )}
              </>
            )}
            {canManage && (
              <>
                <div className="mx-1.5 my-1 h-px bg-slate-100" />
                {canManage && isLive && (
                  <button
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM_DANGER_CLASS}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmCancel(true);
                    }}
                  >
                    <Icon name="ban" className="h-[15px] w-[15px]" />
                    Cancel event
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className={MENU_ITEM_DANGER_CLASS}
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Icon name="trash" className="h-[15px] w-[15px]" />
                  {isDraft ? "Delete draft" : "Delete event"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${eventTitle}"?`}
        body={DELETE_EVENT_DIALOG_BODY}
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

      {/* TODO: when the paid add-on / checkout flow ships, route there
          instead of flipping the flag through this confirm. */}
      <ConfirmDialog
        open={confirmUpgrade}
        destructive={false}
        title="Upgrade this event to premium?"
        body={UPGRADE_EVENT_DIALOG_BODY}
        confirmLabel="Yes, upgrade"
        onClose={() => setConfirmUpgrade(false)}
        onConfirm={async () => {
          const res = await upgradeEvent(eventId);
          setConfirmUpgrade(false);
          if (res.error) return push("error", res.error);
          push("success", "Event upgraded to premium.");
          router.refresh();
        }}
      />

      {isAdmin && (
        <QRDialog
          open={qrOpen}
          eventId={eventId}
          eventTitle={eventTitle}
          onClose={() => setQrOpen(false)}
        />
      )}
    </>
  );
}

/**
 * QR modal. Fetches the 400×400 PNG from the qr route and shows it in
 * the dialog with Download PNG / PDF buttons. Spec confirms 400×400 +
 * PNG + PDF variants and requires a "confirming the QR image has been
 * downloaded" alert — the browser's own download UI covers that.
 */
export function QRDialog({
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
            <a
              href={pngHref}
              download
              onClick={() => push("success", "QR PNG downloaded.")}
            >
              <Button variant="ghost">Download PNG</Button>
            </a>
            <a
              href={pdfHref}
              download
              onClick={() => push("success", "QR PDF downloaded.")}
            >
              <Button>Download PDF</Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Cancel-event modal. Reason is mandatory + capped; the value flows to
 * the public event details page. Kept as a small component so the row
 * layer doesn't own the cancel state.
 */
export function CancelEventDialog({
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
            loading={pending}
            disabled={!reason.trim()}
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
