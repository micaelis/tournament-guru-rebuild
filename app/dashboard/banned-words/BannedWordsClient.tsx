"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Field } from "@/app/(auth)/parts";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormButton,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@/app/components/ui";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import {
  addBannedWord,
  deleteBannedWord,
  updateBannedWord,
  type BannedWordState,
} from "./actions";

const INITIAL: BannedWordState = {};

type BannedRow = { id: string; word: string; created_at: string };

/**
 * Client-side table with inline edit + delete confirmation + add form.
 * Server actions return errors via useActionState (add) or ad-hoc
 * calls (edit / delete) so the row-level pending state can render
 * without a full page transition.
 */
export function BannedWordsClient({ rows }: { rows: BannedRow[] }) {
  const [state, formAction] = useActionState(addBannedWord, INITIAL);
  const { values, capture } = useSubmittedValues();
  const [confirmDelete, setConfirmDelete] = useState<BannedRow | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(
    null,
  );
  const router = useRouter();
  const { push } = useToast();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          Add a word
        </h2>
        <form
          action={(fd) => {
            capture(fd);
            formAction(fd);
          }}
          className="mt-3 space-y-3"
        >
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <Field
            label="Word"
            name="word"
            required
            placeholder="Type a word — spaces + special chars kept as-is"
            defaultValue={values.word ?? ""}
            validate={(v) => {
              const word = v.trim();
              return word && word.length <= 40 ? null : "Invalid word.";
            }}
            error={state.fieldErrors?.word}
          />
          <div className="flex justify-end">
            <FormButton pendingLabel="Adding…">Add</FormButton>
          </div>
        </form>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          {rows.length} word{rows.length === 1 ? "" : "s"} on the list
        </p>
        {rows.length === 0 ? (
          <EmptyState compact title="No banned words yet. Add one above." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Word</TH>
                <TH>Added</TH>
                <TH className="w-40">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    {editing?.id === r.id ? (
                      <input
                        className="tg-control"
                        value={editing.value}
                        onChange={(e) =>
                          setEditing({ id: r.id, value: e.target.value })
                        }
                      />
                    ) : (
                      <span className="font-semibold text-slate-900">{r.word}</span>
                    )}
                  </TD>
                  <TD className="text-xs text-slate-500">
                    {formatDate(r.created_at)}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      {editing?.id === r.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={async () => {
                              const res = await updateBannedWord(
                                r.id,
                                editing.value,
                              );
                              if (res.error) return push("error", res.error);
                              if (res.fieldErrors?.word)
                                return push("error", res.fieldErrors.word);
                              push("success", "Word updated.");
                              setEditing(null);
                              router.refresh();
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditing({ id: r.id, value: r.word })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setConfirmDelete(r)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Delete "${confirmDelete?.word ?? ""}"?`}
        body="Reviews and comments will no longer be blocked on this word after removal."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const res = await deleteBannedWord(confirmDelete.id);
          setConfirmDelete(null);
          if (res.error) return push("error", res.error);
          push("success", "Word removed.");
          router.refresh();
        }}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
