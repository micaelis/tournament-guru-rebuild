"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Field,
  SubmitButton,
} from "../../(auth)/parts";
import {
  Button,
  ConfirmDialog,
  useToast,
} from "@/app/components/ui";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import {
  createTournament,
  updateTournament,
  deleteTournament,
  type ActionState,
} from "./actions";

const INITIAL: ActionState = {};

/**
 * Create tournament modal. Spec: Title (mandatory) + Recurring toggle
 * (stored no-op) + Cancel / Add Tournament. On success we route the
 * caller to a follow-up "Add first event?" step handled by the parent.
 */
export function CreateTournamentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (tournamentId: string) => void;
}) {
  const [state, formAction] = useActionState(createTournament, INITIAL);
  const { values, submitted, capture } = useSubmittedValues();

  useEffect(() => {
    if (state.createdId) onCreated(state.createdId);
  }, [state.createdId, onCreated]);

  if (!open) return null;
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
          Add tournament
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Give your tournament a title. You&apos;ll add events under it next.
        </p>
        <form
          action={(fd) => {
            capture(fd);
            formAction(fd);
          }}
          className="mt-5 space-y-4"
        >
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <Field
            label="Tournament title"
            name="title"
            required
            autoFocus
            defaultValue={values.title ?? ""}
            validate={(v) => (v.trim() ? null : "Tournament title is required.")}
            error={state.fieldErrors?.title}
          />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm">
            <input
              type="checkbox"
              name="recurring"
              defaultChecked={submitted ? values.recurring != null : false}
              className="mt-0.5 h-4 w-4 accent-slate-900"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Recurring event
              </span>
              <span className="block text-xs text-slate-500">
                Informational — the event still needs its own dates.
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton className="!w-auto">Add tournament</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * "Tournament created — add its first event?" prompt shown after
 * createTournament resolves. Spec wants the ED nudged into the event
 * form immediately; we make declining trivial with a Later button.
 */
export function AddFirstEventPrompt({
  tournamentId,
  onDismiss,
}: {
  tournamentId: string;
  onDismiss: () => void;
}) {
  const router = useRouter();
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          Tournament created
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Want to add its first event now? You can always come back later.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onDismiss}>
            Later
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              router.push(
                `/dashboard/events/new?tournament=${tournamentId}` as never,
              );
            }}
          >
            Add first event
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edit tournament dialog — reuses the create action's shape via a
 * distinct server action so the form can render with defaults.
 */
export function EditTournamentDialog({
  open,
  onClose,
  tournament,
}: {
  open: boolean;
  onClose: () => void;
  tournament: { id: string; title: string; recurring: boolean };
}) {
  const [state, formAction] = useActionState(updateTournament, INITIAL);
  const { values, submitted, capture } = useSubmittedValues();
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    if (state.error) push("error", state.error);
  }, [state, open, push]);

  if (!open) return null;
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
          Edit tournament
        </h3>
        <form
          action={(fd) => {
            capture(fd);
            formAction(fd);
          }}
          className="mt-5 space-y-4"
        >
          <input type="hidden" name="id" value={tournament.id} />
          <Field
            label="Tournament title"
            name="title"
            defaultValue={values.title ?? tournament.title}
            required
            validate={(v) => (v.trim() ? null : "Tournament title is required.")}
            error={state.fieldErrors?.title}
          />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm">
            <input
              type="checkbox"
              name="recurring"
              defaultChecked={
                submitted ? values.recurring != null : tournament.recurring
              }
              className="mt-0.5 h-4 w-4 accent-slate-900"
            />
            <span className="block font-semibold text-slate-900">
              Recurring event
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton className="!w-auto">Save changes</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Delete tournament flow. Uses ConfirmDialog with the spec's exact
 * warning copy so the ED knows child events + their child rows are
 * about to disappear (reviews are preserved as detached snapshots).
 */
export function DeleteTournamentButton({
  tournamentId,
  tournamentTitle,
}: {
  tournamentId: string;
  tournamentTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { push } = useToast();
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${tournamentTitle}`}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title={`Delete "${tournamentTitle}"?`}
        body="This action is permanent and will also delete all the events within this tournament. Reviews attached to those events stay in the database, detached, so historical context is preserved."
        confirmLabel={pending ? "Deleting…" : "Delete tournament"}
        onClose={() => (pending ? undefined : setOpen(false))}
        onConfirm={async () => {
          setPending(true);
          const res = await deleteTournament(tournamentId);
          setPending(false);
          if (res.error) {
            push("error", res.error);
            return;
          }
          push("success", "Tournament deleted.");
          setOpen(false);
        }}
      />
    </>
  );
}
