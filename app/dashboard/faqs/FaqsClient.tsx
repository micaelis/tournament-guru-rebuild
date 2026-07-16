"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Field } from "@/app/(auth)/parts";
import {
  Button,
  ConfirmDialog,
  useToast,
} from "@/app/components/ui";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import {
  deleteFaq,
  upsertFaq,
  type FaqState,
} from "./actions";

export type FaqRow = {
  id: string;
  title: string;
  body: string;
  audience: "attendee" | "event_director" | "both";
  sort_order: number;
  created_at: string;
};

const INITIAL: FaqState = {};

export function FaqsClient({ rows }: { rows: FaqRow[] }) {
  const [state, formAction] = useActionState(upsertFaq, INITIAL);
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FaqRow | null>(null);
  // Bumped on each successful save so the keyed form remounts blank.
  const [formEpoch, setFormEpoch] = useState(0);
  const router = useRouter();
  const { push } = useToast();

  // Leave edit mode only once the save succeeds — clearing at dispatch
  // time would remount the keyed form and wipe the typed values when
  // validation fails. React 19 "react to a prop/state change during
  // render" idiom (see Header.tsx) instead of a setState-in-effect.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (!state.error && !state.fieldErrors) {
      setEditing(null);
      setFormEpoch((n) => n + 1);
    }
  }

  return (
    <div className="space-y-6">
      <FaqForm
        key={editing ? editing.id : `new-${formEpoch}`}
        state={state}
        formAction={formAction}
        editing={editing}
        defaultSortOrder={rows.length}
        onCancel={() => setEditing(null)}
      />

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            No FAQs yet — add one above.
          </p>
        ) : (
          rows.map((r) => (
            <details
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-900">
                  {r.title}
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {r.audience === "both"
                      ? "Everyone"
                      : r.audience === "attendee"
                        ? "Attendees"
                        : "Event Directors"}
                  </span>
                  <span className="text-xs text-slate-500">#{r.sort_order}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditing(r);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmDelete(r);
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-700">
                {r.body}
              </p>
            </details>
          ))
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Delete "${confirmDelete?.title ?? ""}"?`}
        body="This is permanent."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const res = await deleteFaq(confirmDelete.id);
          setConfirmDelete(null);
          if (res.error) return push("error", res.error);
          push("success", "FAQ removed.");
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * The upsert form, remounted via `key` whenever the target FAQ changes.
 * useSubmittedValues lives here (not in FaqsClient) so a snapshot taken
 * while editing one FAQ can never leak onto another after a remount.
 */
function FaqForm({
  state,
  formAction,
  editing,
  defaultSortOrder,
  onCancel,
}: {
  state: FaqState;
  formAction: (formData: FormData) => void;
  editing: FaqRow | null;
  defaultSortOrder: number;
  onCancel: () => void;
}) {
  const { values, capture } = useSubmittedValues();
  const { shownError: bodyError, revalidate: revalidateBody } =
    useLiveValidation(state.fieldErrors?.body, (v) =>
      v.trim() ? null : "Body required.",
    );
  const { shownError: audienceError, revalidate: revalidateAudience } =
    useLiveValidation(state.fieldErrors?.audience, (v) =>
      ["attendee", "event_director", "both"].includes(v)
        ? null
        : "Invalid audience.",
    );

  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
        {editing ? "Edit FAQ" : "New FAQ"}
      </h2>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <Field
        label="Title"
        name="title"
        required
        defaultValue={values.title ?? editing?.title ?? ""}
        validate={(v) => (v.trim() ? null : "Title required.")}
        error={state.fieldErrors?.title}
      />
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
          Body
        </span>
        <textarea
          name="body"
          rows={5}
          required
          defaultValue={values.body ?? editing?.body ?? ""}
          onInput={(e) => revalidateBody(e.currentTarget)}
          className="tg-control resize-none"
        />
        {bodyError && (
          <p className="mt-1 text-xs font-medium text-red-600">{bodyError}</p>
        )}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
          Audience
        </span>
        <select
          name="audience"
          defaultValue={values.audience ?? editing?.audience ?? "both"}
          onChange={(e) => revalidateAudience(e.currentTarget)}
          className="tg-control tg-select"
        >
          <option value="both">Everyone</option>
          <option value="attendee">Attendees only</option>
          <option value="event_director">Event Directors only</option>
        </select>
        {audienceError && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {audienceError}
          </p>
        )}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
          Sort order
        </span>
        <input
          name="sort_order"
          type="number"
          min={0}
          defaultValue={values.sort_order ?? editing?.sort_order ?? defaultSortOrder}
          className="tg-control"
        />
      </label>
      <div className="flex justify-end gap-2">
        {editing && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit">{editing ? "Save" : "Add FAQ"}</Button>
      </div>
    </form>
  );
}
