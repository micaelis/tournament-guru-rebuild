"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, ConfirmDialog, cn, useToast } from "@/app/components/ui";
import { Icon } from "@/app/dashboard/icons";
import {
  CancelEventDialog,
  DELETE_EVENT_DIALOG_BODY,
  QRDialog,
  UPGRADE_EVENT_DIALOG_BODY,
} from "../EventActions";
import { deleteEvent, duplicateEvent, upgradeEvent } from "../event-actions";

const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2.5 rounded-[9px] px-[11px] py-[9px] text-left text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900";

/**
 * The hero's management column: Edit (primary), Duplicate + Share,
 * optional Upgrade (EDs → the coming-soon add-ons preview; admins → the
 * on-behalf premium confirm), then the red-tinted Cancel/Delete danger
 * pair. Same
 * wiring as the row-level EventActions — shared dialogs, same server
 * actions — laid out as the details page's control stack. QR items are
 * admin-only because the qr route itself rejects non-admins; the
 * affordance mirrors the gate, it doesn't replace it.
 */
export function DetailsActionPanel({
  eventId,
  eventTitle,
  lifecycle,
  isPremium,
  canManage,
  isAdmin = false,
}: {
  eventId: string;
  eventTitle: string;
  lifecycle: "draft" | "active" | "canceled";
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
  const [shareOpen, setShareOpen] = useState(false);
  const [duplicating, startDuplicate] = useTransition();
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!shareRef.current?.contains(e.target as Node)) setShareOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShareOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [shareOpen]);

  async function copyPublicLink() {
    const url = `${window.location.origin}/events/${eventId}`;
    try {
      await navigator.clipboard.writeText(url);
      push("success", "Public link copied to clipboard.");
    } catch {
      push("error", "Couldn't copy — check your browser permissions.");
    }
  }

  return (
    <div>
      <Button
        className="w-full"
        onClick={() =>
          router.push(`/dashboard/events/${eventId}/edit` as Route)
        }
      >
        <Icon name="edit" className="h-4 w-4" />
        Edit event
      </Button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {canManage && (
          <Button
            variant="secondary"
            size="sm"
            loading={duplicating}
            onClick={() =>
              startDuplicate(async () => {
                const res = await duplicateEvent(eventId);
                if (res?.error) push("error", res.error);
              })
            }
          >
            {!duplicating && (
              <Icon name="copy" className="h-3.5 w-3.5 text-slate-500" />
            )}
            Duplicate
          </Button>
        )}
        <div
          ref={shareRef}
          className={cn("relative", !canManage && "col-span-2")}
        >
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            aria-haspopup="menu"
            aria-expanded={shareOpen}
            aria-label="Share — copy the public link or download the QR code"
            onClick={() => setShareOpen((o) => !o)}
          >
            <Icon name="qr" className="h-3.5 w-3.5 text-slate-500" />
            Share
            <Icon name="chevron-down" className="h-3 w-3 text-slate-400" />
          </Button>
          {shareOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-50 w-[232px] rounded-[14px] border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(15,23,42,.25)]"
            >
              <button
                type="button"
                role="menuitem"
                className={MENU_ITEM_CLASS}
                onClick={async () => {
                  setShareOpen(false);
                  await copyPublicLink();
                }}
              >
                <Icon name="link" className="h-[15px] w-[15px] text-slate-400" />
                Copy public link
              </button>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM_CLASS}
                    onClick={() => {
                      setShareOpen(false);
                      setQrOpen(true);
                    }}
                  >
                    <Icon name="qr" className="h-[15px] w-[15px] text-slate-400" />
                    View QR code
                  </button>
                  <a
                    role="menuitem"
                    className={MENU_ITEM_CLASS}
                    href={`/dashboard/events/qr/${eventId}?format=png`}
                    download
                    onClick={() => {
                      setShareOpen(false);
                      push("success", "QR PNG downloaded.");
                    }}
                  >
                    <Icon
                      name="download"
                      className="h-[15px] w-[15px] text-slate-400"
                    />
                    Download QR — PNG
                  </a>
                  <a
                    role="menuitem"
                    className={MENU_ITEM_CLASS}
                    href={`/dashboard/events/qr/${eventId}?format=pdf`}
                    download
                    onClick={() => {
                      setShareOpen(false);
                      push("success", "QR PDF downloaded.");
                    }}
                  >
                    <Icon
                      name="download"
                      className="h-[15px] w-[15px] text-slate-400"
                    />
                    Download QR — PDF
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {canManage && !isPremium && (
        <Button
          variant="accent"
          size="sm"
          className="mt-2 w-full"
          onClick={() =>
            isAdmin
              ? setConfirmUpgrade(true)
              : router.push(`/dashboard/events/${eventId}/add-ons` as Route)
          }
        >
          ★ Upgrade to premium
        </Button>
      )}

      {canManage && (
        <>
          <div className="my-3.5 h-px bg-slate-100" />
          {/* nowrap labels + flex-wrap: a too-narrow column stacks the
              pair instead of breaking "Cancel event" across lines */}
          <div className="flex flex-wrap gap-2">
            {lifecycle === "active" && (
              <Button
                variant="danger"
                size="sm"
                className="flex-auto whitespace-nowrap"
                onClick={() => setConfirmCancel(true)}
              >
                <Icon name="ban" className="h-3.5 w-3.5" />
                Cancel event
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              className="flex-auto whitespace-nowrap"
              onClick={() => setConfirmDelete(true)}
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </>
      )}

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
          // The page under our feet is gone — land on the list, not a 404.
          router.push("/dashboard/events" as Route);
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

      {/* Admin-only: the on-behalf premium flip while payments are
          deferred. EDs land on the coming-soon add-ons preview instead. */}
      {isAdmin && (
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
            push("success", "Event upgraded. Premium fields are now editable.");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Copies the public event link — the no-reviews band's call to action. */
export function InviteReviewsButton({ eventId }: { eventId: string }) {
  const { push } = useToast();
  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-2 rounded-[10px] border-[1.5px] border-white/30 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-white/10"
      onClick={async () => {
        const url = `${window.location.origin}/events/${eventId}`;
        try {
          await navigator.clipboard.writeText(url);
          push("success", "Public link copied — share it to invite reviews.");
        } catch {
          push("error", "Couldn't copy — check your browser permissions.");
        }
      }}
    >
      <Icon name="link" className="h-3.5 w-3.5" />
      Invite reviews
    </button>
  );
}

/** Icon-only clipboard button for the Listing record's Event ID row. */
export function CopyIdButton({ value }: { value: string }) {
  const { push } = useToast();
  return (
    <button
      type="button"
      aria-label="Copy event ID"
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          push("success", "Event ID copied.");
        } catch {
          push("error", "Couldn't copy — check your browser permissions.");
        }
      }}
    >
      <Icon name="copy" className="h-3 w-3" />
    </button>
  );
}
