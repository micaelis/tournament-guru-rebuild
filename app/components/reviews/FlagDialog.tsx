"use client";

import { useState } from "react";
import { Button, useToast } from "@/app/components/ui";
import { flagContent, type ReviewState } from "@/lib/reviews/actions";

const REASONS = [
  { value: "profanity", label: "Profanity" },
  { value: "illicit", label: "Illicit material" },
  { value: "solicitation", label: "Solicitation" },
  { value: "other", label: "Other" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

/**
 * The shared flag modal — same shape for review + comment flags
 * (spec: "the same Flag Content popup"). Requires one reason; the
 * additional-info textarea is mandatory only when reason='other'
 * (SCHEMA-DESIGN §5 + Reviews RTF confirm).
 */
export function FlagDialog({
  open,
  contentType,
  contentId,
  onClose,
  onFlagged,
}: {
  open: boolean;
  contentType: "review" | "comment";
  contentId: string;
  onClose: () => void;
  onFlagged: () => void;
}) {
  const [reason, setReason] = useState<Reason | "">("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const { push } = useToast();

  if (!open) return null;
  const submit = async () => {
    if (!reason) {
      setFieldError("Pick a reason to continue.");
      return;
    }
    setPending(true);
    const res: ReviewState = await flagContent({
      contentType,
      contentId,
      reason,
      additionalInfo: info,
    });
    setPending(false);
    if (res.error) {
      push("error", res.error);
      return;
    }
    if (res.fieldErrors?.additional_info) {
      setFieldError(res.fieldErrors.additional_info);
      return;
    }
    push(
      "success",
      `Thank you! The admin will be notified about this ${contentType}.`,
    );
    onFlagged();
  };

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
        <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          Flag this {contentType}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Please select one of the reasons below why you would like to flag
          this {contentType} for.
        </p>
        <fieldset className="mt-4 space-y-2">
          {REASONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:border-slate-400 has-[input:checked]:border-slate-900 has-[input:checked]:bg-slate-900 has-[input:checked]:text-white"
            >
              <input
                type="radio"
                name="reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={() => {
                  setReason(opt.value);
                  setFieldError(undefined);
                }}
                className="sr-only"
              />
              <span className="font-semibold">{opt.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
            Additional information
            {reason === "other" && <span className="text-red-600"> *</span>}
          </span>
          <textarea
            rows={3}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            className="tg-control resize-none"
            placeholder="What made this problematic?"
          />
        </label>
        {fieldError && (
          <p className="mt-1 text-xs font-medium text-red-600">{fieldError}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={submit}
            disabled={pending || !reason}
          >
            {pending ? "Sending…" : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
