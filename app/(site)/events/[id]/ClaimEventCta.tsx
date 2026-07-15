"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Route } from "next";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, Field } from "@/app/(auth)/parts";
import {
  Button,
  useToast,
} from "@/app/components/ui";
import {
  submitClaimRequest,
  type ClaimState,
} from "@/lib/claims/actions";

type CtaState = "anon" | "requestable" | "requested" | "claimed";

const INITIAL: ClaimState = {};

/**
 * Claim CTA on the public event page. State branches per spec:
 * - anon: routes to /signup?type=event_director&next=<current>
 * - requestable: opens the "Request Authorized Access" modal
 * - requested: shows a non-clickable "Requested" chip
 * - claimed: nothing renders (owner_id is set, so the event card
 *   shows the owner's org info instead)
 */
export function ClaimEventCta({
  eventId,
  state,
}: {
  eventId: string;
  state: CtaState;
}) {
  const [open, setOpen] = useState(false);
  if (state === "claimed") return null;
  if (state === "requested") {
    return (
      <button
        type="button"
        disabled
        className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500"
      >
        Requested
      </button>
    );
  }
  if (state === "anon") {
    return (
      <Link
        href={
          `/signup?type=event_director&next=${encodeURIComponent(`/events/${eventId}`)}` as Route
        }
      >
        <Button>Claim this event</Button>
      </Link>
    );
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>Claim this event</Button>
      {open && (
        <ClaimModal eventId={eventId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ClaimModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(submitClaimRequest, INITIAL);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => {
    if (state.claimId) {
      push(
        "success",
        "Request received. The admin will follow up soon.",
      );
      onClose();
      router.refresh();
    }
  }, [state.claimId, push, onClose, router]);

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
          Request Authorised Access
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          We can provide you with access to manage the listing for this event.
          Provide us with a <strong>link</strong> to an event site that shows
          your connection or a <strong>phone number</strong> where you can be
          reached.
        </p>
        <form
          action={(fd) =>
            startTransition(() => formAction(fd))
          }
          className="mt-5 space-y-4"
        >
          <input type="hidden" name="event_id" value={eventId} />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <Field
            label="Phone number"
            name="phone"
            required
            placeholder="+1 555 555 5555"
            error={state.fieldErrors?.phone}
          />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
              Links {" "}
              <span className="text-red-600">*</span>
            </span>
            <textarea
              name="links"
              rows={3}
              className="tg-control resize-none"
              placeholder="One URL per line"
            />
            {state.fieldErrors?.links && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {state.fieldErrors.links}
              </p>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
              Additional info
            </span>
            <textarea
              name="message"
              rows={3}
              className="tg-control resize-none"
              placeholder="Anything else the admin should know."
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
