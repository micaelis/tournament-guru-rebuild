"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/app/(auth)/parts";
import { Button, useToast } from "@/app/components/ui";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { saveComment, type ReviewState } from "@/lib/reviews/actions";
import { REVIEW_BODY_MAX } from "@/lib/reviews/shared";
import type { ReviewCardRow } from "@/lib/reviews/queries";

const INITIAL: ReviewState = {};

/**
 * ED owner-reply modal — mirrors the flow the public event page uses,
 * except this variant lives in the dashboard so the ED never has to
 * leave the reviews table. Adding a reply when one exists deletes the
 * prior one automatically (server enforces the "one owner reply per
 * review" rule).
 */
export function OwnerReplyDialog({
  review,
  onClose,
}: {
  review: ReviewCardRow;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(saveComment, INITIAL);
  const [body, setBody] = useState("");
  // Mirrors saveComment's non-empty + length rules; the banned-word
  // check stays server-side, so those errors also clear on a valid edit
  // and the server re-verifies on resubmit.
  const { shownError: bodyError, revalidate: revalidateBody } =
    useLiveValidation(state.fieldErrors?.body, (v) => {
      const trimmed = v.trim();
      return trimmed && trimmed.length <= REVIEW_BODY_MAX
        ? null
        : "Invalid reply.";
    });
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => {
    if (state.error) push("error", state.error);
  }, [state.error, push]);

  const over = body.length > REVIEW_BODY_MAX;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          Reply as the event owner
        </h3>
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-900">
            {review.review_title || "Untitled review"}
          </p>
          <p className="mt-1 line-clamp-3 text-slate-500">
            {review.review_body}
          </p>
        </div>
        <form
          action={async (fd) => {
            if (over) {
              push("error", "Trim your reply below the character limit.");
              return;
            }
            await formAction(fd);
            if (!state.error) {
              push("success", "Reply posted.");
              onClose();
              router.refresh();
            }
          }}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="review_id" value={review.id} />
          {bodyError && <Alert kind="error">{bodyError}</Alert>}
          <textarea
            name="body"
            rows={4}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              revalidateBody(e.currentTarget);
            }}
            className="tg-control resize-none"
            placeholder="Thanks for coming out, we appreciate…"
          />
          <div className="flex items-center justify-between text-xs">
            <span className={over ? "font-medium text-red-600" : "text-slate-500"}>
              {body.length}/{REVIEW_BODY_MAX}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!body.trim() || over}>
              Post reply
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
