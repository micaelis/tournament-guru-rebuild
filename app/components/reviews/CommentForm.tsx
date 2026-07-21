"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/app/(auth)/parts";
import { Button, FormButton, useToast } from "@/app/components/ui";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { saveComment, type ReviewState } from "@/lib/reviews/actions";
import { findBannedWords } from "@/lib/reviews/client-check";
import { REVIEW_BODY_MAX } from "@/lib/reviews/shared";

const INITIAL: ReviewState = {};

/**
 * Add or edit a comment (or a reply to another comment). Passing
 * `parentCommentId` builds it as a threaded reply. The action does
 * the "one owner reply per review" enforcement for ED replies.
 */
export function CommentForm({
  reviewId,
  parentCommentId,
  commentId,
  initialBody,
  bannedWords,
  onDone,
  placeholder,
  submitLabel = "Post",
}: {
  reviewId: string;
  parentCommentId?: string;
  commentId?: string;
  initialBody?: string;
  bannedWords: string[];
  onDone?: () => void;
  placeholder?: string;
  submitLabel?: string;
}) {
  const [body, setBody] = useState(initialBody ?? "");
  const [state, formAction] = useActionState(saveComment, INITIAL);
  const router = useRouter();
  const { push } = useToast();
  const over = body.length > REVIEW_BODY_MAX;
  const banned = useMemo(() => findBannedWords(body, bannedWords), [body, bannedWords]);
  const { shownError: bodyError, revalidate: revalidateBody } =
    useLiveValidation(state.fieldErrors?.body, (v) => {
      const trimmed = v.trim();
      if (!trimmed) return "Add a comment first.";
      if (trimmed.length > REVIEW_BODY_MAX) {
        return `Comments cap at ${REVIEW_BODY_MAX} characters.`;
      }
      return findBannedWords(v, bannedWords).length > 0
        ? "Your comment contains words we don't allow."
        : null;
    });

  useEffect(() => {
    // A successful save carries no error / fieldErrors. When the action
    // resolves cleanly, refresh so server queries repick the new row.
    if (!state.error && !state.fieldErrors) return;
  }, [state]);

  return (
    <form
      action={async (fd) => {
        if (over || banned.length > 0) {
          push("error", "Please fix the issues before posting.");
          return;
        }
        await formAction(fd);
        onDone?.();
        router.refresh();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="review_id" value={reviewId} />
      {parentCommentId && (
        <input type="hidden" name="parent_comment_id" value={parentCommentId} />
      )}
      {commentId && <input type="hidden" name="comment_id" value={commentId} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <textarea
        name="body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          revalidateBody(e.currentTarget);
        }}
        rows={3}
        placeholder={placeholder ?? "Add a comment…"}
        className="tg-control resize-none"
        aria-invalid={over || undefined}
      />
      <div className="flex items-center justify-between text-xs">
        <span className={over ? "font-medium text-red-600" : "text-slate-500"}>
          {body.length}/{REVIEW_BODY_MAX}
        </span>
        {banned.length > 0 && (
          <span className="font-medium text-red-600">
            Remove: {banned.join(", ")}
          </span>
        )}
      </div>
      {bodyError && (
        <p className="text-xs font-medium text-red-600">{bodyError}</p>
      )}
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        <FormButton
          size="sm"
          pendingLabel="Posting…"
          disabled={!body.trim() || over || banned.length > 0}
        >
          {submitLabel}
        </FormButton>
      </div>
    </form>
  );
}
