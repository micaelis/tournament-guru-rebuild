"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Field } from "@/app/(auth)/parts";
import { Button, FormButton, StarRating, useToast } from "@/app/components/ui";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import {
  adminEditReview,
  type ReviewState,
} from "@/lib/reviews/actions";
import {
  REVIEW_BODY_MAX,
  REVIEW_CATEGORIES,
  type ReviewCategoryKey,
} from "@/lib/reviews/shared";
import type { ReviewCardRow } from "@/lib/reviews/queries";

const INITIAL: ReviewState = {};

/**
 * Admin edit modal — spec: "The Admin should be able to edit or
 * delete a review in a popup, with the event card at the top. The
 * edit fields are — review title, review description, and the rating
 * for each of the 6 review categories."
 */
export function AdminEditDialog({
  review,
  onClose,
}: {
  review: ReviewCardRow & {
    event: { id: string; title: string } | null;
  };
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(adminEditReview, INITIAL);
  const [title, setTitle] = useState(review.review_title ?? "");
  const [body, setBody] = useState(review.review_body ?? "");
  const [ratings, setRatings] = useState<Record<ReviewCategoryKey, number | null>>({
    rating_fields: review.rating_fields,
    rating_facilities: review.rating_facilities,
    rating_management: review.rating_management,
    rating_competition: review.rating_competition,
    rating_diversity: review.rating_diversity,
    rating_cost_value: review.rating_cost_value,
  });
  const router = useRouter();
  const { push } = useToast();
  const over = body.length > REVIEW_BODY_MAX;
  // The server only rejects the body on banned words, which we can't
  // check client-side — so any edit optimistically clears the error and
  // the server re-verifies on resubmit.
  const { shownError: bodyError, revalidate: revalidateBody } =
    useLiveValidation(state.fieldErrors?.review_body);

  useEffect(() => {
    if (state.savedId) {
      push("success", "Review updated.");
      onClose();
      router.refresh();
    }
  }, [state.savedId, push, onClose, router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          Edit review
        </h3>
        {review.event && (
          <p className="mt-1 text-sm text-slate-500">
            On event <span className="font-semibold">{review.event.title}</span>
          </p>
        )}
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="review_id" value={review.id} />
          {(Object.keys(ratings) as ReviewCategoryKey[]).map((k) => (
            <input
              key={k}
              type="hidden"
              name={k}
              value={ratings[k] ?? ""}
            />
          ))}
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <Field
            label="Title"
            name="review_title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={state.fieldErrors?.review_title}
          />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
              Review body
            </span>
            <textarea
              name="review_body"
              rows={5}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                revalidateBody(e.currentTarget);
              }}
              className="tg-control resize-none"
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span
                className={over ? "font-medium text-red-600" : "text-slate-500"}
              >
                {body.length}/{REVIEW_BODY_MAX}
              </span>
              {bodyError && (
                <span className="font-medium text-red-600">{bodyError}</span>
              )}
            </div>
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {REVIEW_CATEGORIES.map((c) => (
              <div key={c.key} className="rounded-xl border border-slate-200 p-3">
                <p className="text-[12px] font-semibold text-slate-800">
                  {c.label}
                </p>
                <div className="mt-1">
                  <StarRating
                    value={ratings[c.key] ?? 0}
                    interactive
                    showNumber={false}
                    size={20}
                    onChange={(v) =>
                      setRatings((prev) => ({ ...prev, [c.key]: v }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <FormButton disabled={over} pendingLabel="Saving…">
              Save changes
            </FormButton>
          </div>
        </form>
      </div>
    </div>
  );
}
