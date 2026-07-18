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
  type AudienceInput,
  type FaqState,
} from "./actions";

export type FaqAudienceRow = {
  user_type: string;
  role_title: string | null;
};

export type FaqRow = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  faq_audiences: FaqAudienceRow[];
};

const INITIAL: FaqState = {};

const ATTENDEE_ROLES = [
  { value: "coach", label: "Coach" },
  { value: "team_manager", label: "Team Manager" },
  { value: "parent_spectator", label: "Parent/Spectator" },
];

const ED_ROLES = [
  { value: "event_director", label: "Event Director" },
  { value: "event_admin", label: "Event Admin" },
  { value: "club_director", label: "Club Director" },
];

function audienceLabel(audiences: FaqAudienceRow[]): string {
  const types = new Set(audiences.map((a) => a.user_type));
  const parts: string[] = [];
  if (types.has("attendee")) parts.push("Attendee");
  if (types.has("event_director")) parts.push("ED");
  return parts.join(", ") || "None";
}

export function FaqsClient({ rows }: { rows: FaqRow[] }) {
  const [state, formAction] = useActionState(upsertFaq, INITIAL);
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FaqRow | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const router = useRouter();
  const { push } = useToast();

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
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: r.status === "published" ? "#ecfdf5" : "#f8fafc",
                      borderColor: r.status === "published" ? "#a7f3d0" : "#e2e8f0",
                      color: r.status === "published" ? "#065f46" : "#64748b",
                    }}
                  >
                    {r.status === "published" ? "Published" : "Draft"}
                  </span>
                  {!r.is_visible && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Hidden
                    </span>
                  )}
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {audienceLabel(r.faq_audiences)}
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
                {r.content}
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
  const { shownError: contentError, revalidate: revalidateContent } =
    useLiveValidation(state.fieldErrors?.content, (v) =>
      v.trim() ? null : "Content required.",
    );

  const editingTypes = new Set(
    (editing?.faq_audiences ?? []).map((a) => a.user_type),
  );
  const [attendeeChecked, setAttendeeChecked] = useState(
    editing ? editingTypes.has("attendee") : true,
  );
  const [edChecked, setEdChecked] = useState(
    editing ? editingTypes.has("event_director") : true,
  );

  const hasAttRoles = (editing?.faq_audiences ?? []).some(
    (a) => a.user_type === "attendee" && a.role_title,
  );
  const hasEdRoles = (editing?.faq_audiences ?? []).some(
    (a) => a.user_type === "event_director" && a.role_title,
  );
  const [attRoles, setAttRoles] = useState<Set<string>>(
    hasAttRoles
      ? new Set(
          (editing?.faq_audiences ?? [])
            .filter((a) => a.user_type === "attendee" && a.role_title)
            .map((a) => a.role_title!),
        )
      : new Set<string>(),
  );
  const [edRoles, setEdRoles] = useState<Set<string>>(
    hasEdRoles
      ? new Set(
          (editing?.faq_audiences ?? [])
            .filter((a) => a.user_type === "event_director" && a.role_title)
            .map((a) => a.role_title!),
        )
      : new Set<string>(),
  );

  function buildAudiences(): AudienceInput[] {
    const result: AudienceInput[] = [];
    if (attendeeChecked) {
      if (attRoles.size > 0) {
        attRoles.forEach((r) =>
          result.push({ user_type: "attendee", role_title: r }),
        );
      } else {
        result.push({ user_type: "attendee", role_title: null });
      }
    }
    if (edChecked) {
      if (edRoles.size > 0) {
        edRoles.forEach((r) =>
          result.push({ user_type: "event_director", role_title: r }),
        );
      } else {
        result.push({ user_type: "event_director", role_title: null });
      }
    }
    return result;
  }

  function toggleRole(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    role: string,
  ) {
    const next = new Set(set);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setter(next);
  }

  return (
    <form
      action={(fd) => {
        const audiences = buildAudiences();
        fd.set("audiences", JSON.stringify(audiences));
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
          Content
        </span>
        <textarea
          name="content"
          rows={5}
          required
          defaultValue={values.content ?? editing?.content ?? ""}
          onInput={(e) => revalidateContent(e.currentTarget)}
          className="tg-control resize-none"
        />
        {contentError && (
          <p className="mt-1 text-xs font-medium text-red-600">{contentError}</p>
        )}
      </label>

      {/* Audience targeting */}
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">
          Audience
        </legend>
        {state.fieldErrors?.audiences && (
          <p className="text-xs font-medium text-red-600">
            {state.fieldErrors.audiences}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={attendeeChecked}
            onChange={() => {
              setAttendeeChecked(!attendeeChecked);
              if (attendeeChecked) setAttRoles(new Set());
            }}
          />
          Attendee
        </label>
        {attendeeChecked && (
          <div className="ml-6 flex flex-wrap gap-1.5">
            {ATTENDEE_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleRole(attRoles, setAttRoles, r.value)}
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  background: attRoles.has(r.value) ? "#dbeafe" : "#f8fafc",
                  borderColor: attRoles.has(r.value) ? "#93c5fd" : "#e2e8f0",
                  color: attRoles.has(r.value) ? "#1e40af" : "#64748b",
                }}
              >
                {r.label}
              </button>
            ))}
            <span className="self-center text-[10px] text-slate-400">
              {attRoles.size === 0 ? "(all roles)" : ""}
            </span>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={edChecked}
            onChange={() => {
              setEdChecked(!edChecked);
              if (edChecked) setEdRoles(new Set());
            }}
          />
          Event Director
        </label>
        {edChecked && (
          <div className="ml-6 flex flex-wrap gap-1.5">
            {ED_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleRole(edRoles, setEdRoles, r.value)}
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  background: edRoles.has(r.value) ? "#dbeafe" : "#f8fafc",
                  borderColor: edRoles.has(r.value) ? "#93c5fd" : "#e2e8f0",
                  color: edRoles.has(r.value) ? "#1e40af" : "#64748b",
                }}
              >
                {r.label}
              </button>
            ))}
            <span className="self-center text-[10px] text-slate-400">
              {edRoles.size === 0 ? "(all roles)" : ""}
            </span>
          </div>
        )}
      </fieldset>

      {/* Status + visibility */}
      <div className="flex flex-wrap gap-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Status
          </span>
          <select
            name="status"
            defaultValue={values.status ?? editing?.status ?? "draft"}
            className="tg-control tg-select"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-800">
          <input
            type="checkbox"
            name="is_visible"
            defaultChecked={editing?.is_visible ?? true}
          />
          Visible to audience
        </label>
      </div>

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
