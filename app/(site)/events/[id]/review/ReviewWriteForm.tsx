"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Field } from "@/app/(auth)/parts";
import {
  Button,
  StarRating,
} from "@/app/components/ui";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { saveReview, type ReviewState } from "@/lib/reviews/actions";
import {
  REVIEW_BODY_MAX,
  REVIEW_CATEGORIES,
  needsWouldReturn,
  type ReviewCategoryKey,
} from "@/lib/reviews/shared";
import { findBannedWords } from "@/lib/reviews/client-check";

const INITIAL: ReviewState = {};

const CATEGORY_HELP: Record<ReviewCategoryKey, string> = {
  rating_fields: "Consider the playing surfaces & equipment provided.",
  rating_facilities:
    "Consider the appearance, accessibility, and cleanliness of the parks, restrooms, parking, concessions.",
  rating_management:
    "Consider the quality of the event website as well as the quality, frequency, and promptness of communications from the event staff.",
  rating_competition:
    "Consider the scheduling accommodations and bracket placement your team(s) experienced.",
  rating_diversity:
    "Consider the number of teams in your division/age group that came from out of town or markets you don't face regularly.",
  rating_cost_value:
    "Consider how the event price and product you received compared to other events you have experienced.",
};

type Defaults = {
  reviewId: string;
  review_title: string;
  review_body: string;
  rating_fields: number | null;
  rating_facilities: number | null;
  rating_management: number | null;
  rating_competition: number | null;
  rating_diversity: number | null;
  rating_cost_value: number | null;
  would_return: boolean | null;
  status: "draft" | "published";
};

/**
 * The public review form. Six category rating selectors, a title,
 * a body with live remaining-character count + inline banned-word
 * warnings, and a would_return prompt for coach + team-manager
 * reviewers. Submitting opens a Confirm & Publish dialog so the user
 * previews their input before it goes live (spec).
 */
export function ReviewWriteForm({
  eventId,
  promoId,
  defaults,
  reviewerRole,
  bannedWords,
}: {
  eventId: string;
  promoId?: string;
  defaults: Defaults | null;
  reviewerRole: string;
  bannedWords: string[];
}) {
  const [state, formAction, isPending] = useActionState(saveReview, INITIAL);
  const [ratings, setRatings] = useState<Record<ReviewCategoryKey, number | null>>({
    rating_fields: defaults?.rating_fields ?? null,
    rating_facilities: defaults?.rating_facilities ?? null,
    rating_management: defaults?.rating_management ?? null,
    rating_competition: defaults?.rating_competition ?? null,
    rating_diversity: defaults?.rating_diversity ?? null,
    rating_cost_value: defaults?.rating_cost_value ?? null,
  });
  const [title, setTitle] = useState(defaults?.review_title ?? "");
  const [body, setBody] = useState(defaults?.review_body ?? "");
  const [wouldReturn, setWouldReturn] = useState<null | boolean>(
    defaults?.would_return ?? null,
  );
  const [intent, setIntent] = useState<"draft" | "publish">("draft");
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();
  const askWouldReturn = needsWouldReturn(reviewerRole);

  const bodyOver = body.length > REVIEW_BODY_MAX;
  const bannedInTitle = useMemo(
    () => findBannedWords(title, bannedWords),
    [title, bannedWords],
  );
  const bannedInBody = useMemo(
    () => findBannedWords(body, bannedWords),
    [body, bannedWords],
  );
  const bannedHits = Array.from(new Set([...bannedInTitle, ...bannedInBody]));
  const { shownError: bodyError, revalidate: revalidateBody } =
    useLiveValidation(state.fieldErrors?.review_body, (v) => {
      const trimmed = v.trim();
      if (!trimmed) return "Add a few details about your experience.";
      if (trimmed.length > REVIEW_BODY_MAX) return "Over the character limit.";
      return bannedInTitle.length > 0 ||
        findBannedWords(v, bannedWords).length > 0
        ? "Contains words we don't allow."
        : null;
    });

  useEffect(() => {
    if (state.savedId) {
      const message =
        intent === "publish"
          ? "Your review has been published"
          : "Draft saved — finish it anytime";
      router.push(`/events/${eventId}?flash=success:${message}`);
    }
  }, [state.savedId, router, eventId, intent]);

  const canPublish =
    REVIEW_CATEGORIES.every((c) => ratings[c.key] !== null) &&
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !bodyOver &&
    bannedHits.length === 0 &&
    (!askWouldReturn || wouldReturn !== null);

  const submitDraft = () => {
    setIntent("draft");
    formRef.current?.requestSubmit();
  };
  const openConfirm = () => setShowConfirm(true);
  const confirmPublish = () => {
    setShowConfirm(false);
    setIntent("publish");
    // React's setState is async; use the ref + microtask to submit AFTER
    // the intent input rerenders with value="publish".
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  return (
    <>
      <form ref={formRef} action={formAction} className="space-y-8">
        <input type="hidden" name="event_id" value={eventId} />
        {defaults?.reviewId && (
          <input type="hidden" name="review_id" value={defaults.reviewId} />
        )}
        {promoId && <input type="hidden" name="promo_id" value={promoId} />}
        <input type="hidden" name="intent" value={intent} />
        {REVIEW_CATEGORIES.map((c) => (
          <input
            key={c.key}
            type="hidden"
            name={c.key}
            value={ratings[c.key] ?? ""}
          />
        ))}
        {askWouldReturn && (
          <input
            type="hidden"
            name="would_return"
            value={wouldReturn === true ? "yes" : wouldReturn === false ? "no" : ""}
          />
        )}

        {state.error && <Alert kind="error">{state.error}</Alert>}

        <section className="space-y-3">
          <h2 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
            Rate your experience
          </h2>
          <p className="text-sm text-slate-500">
            1 = Not good, 5 = Great. All six categories are required to
            publish.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-[11px] font-semibold text-slate-500">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="inline-flex items-center gap-1">
                <StarRating value={n} showNumber={false} size={12} />
                {["Not good", "Could be better", "Average", "Good", "Great"][n - 1]}
              </span>
            ))}
          </div>
        </section>

        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
          {REVIEW_CATEGORIES.map((c) => (
            <div key={c.key}>
              <p className="text-[13px] font-bold text-slate-800">
                {c.label}
              </p>
              <p className="text-xs text-slate-500">{CATEGORY_HELP[c.key]}</p>
              <div className="mt-2">
                <StarRating
                  value={ratings[c.key] ?? 0}
                  interactive
                  label={c.label}
                  showNumber={false}
                  size={22}
                  onChange={(v) =>
                    setRatings((r) => ({ ...r, [c.key]: v }))
                  }
                />
              </div>
              {state.fieldErrors?.[c.key] && ratings[c.key] === null && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {state.fieldErrors[c.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <h2 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
            Tell attendees what happened
          </h2>
          <p className="text-sm text-slate-500">
            A title + a few sentences of context. What worked, what didn&apos;t.
          </p>
        </section>

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <Field
            label="Review title"
            name="review_title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            validate={(v) => (v.trim() ? null : "Include a title.")}
            error={state.fieldErrors?.review_title}
          />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
              Review
            </span>
            <textarea
              name="review_body"
              rows={6}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                revalidateBody(e.currentTarget);
              }}
              className="tg-control resize-none"
              aria-invalid={bodyOver || undefined}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={bodyOver ? "font-medium text-red-600" : "text-slate-500"}>
                {body.length}/{REVIEW_BODY_MAX}
                {bodyOver && " — over the limit"}
              </span>
              {bodyError && (
                <span className="font-medium text-red-600">
                  {bodyError}
                </span>
              )}
            </div>
          </label>
          {bannedHits.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              Please remove or rephrase:{" "}
              <span className="font-semibold">{bannedHits.join(", ")}</span>
            </div>
          )}
        </div>

        {askWouldReturn && (
          <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
            <h2 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
              Would you return?
            </h2>
            <p className="text-sm text-slate-500">
              Coaches and team managers only — helps future attendees decide.
            </p>
            <div className="flex gap-3">
              {[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setWouldReturn(opt.value)}
                  className={`rounded-xl border px-5 py-2 text-sm font-semibold transition ${
                    wouldReturn === opt.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {state.fieldErrors?.would_return && wouldReturn === null && (
              <p className="text-xs font-medium text-red-600">
                {state.fieldErrors.would_return}
              </p>
            )}
          </section>
        )}

        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 backdrop-blur">
          <p className="text-xs text-slate-500">
            Save any time as a draft; publish when it&apos;s ready.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              loading={isPending && intent === "draft"}
              onClick={submitDraft}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isPending && intent === "publish"}
              disabled={!canPublish}
              onClick={openConfirm}
            >
              Publish
            </Button>
          </div>
        </div>
      </form>

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
              Publish this review?
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="font-semibold">{title}</p>
              <p className="whitespace-pre-line text-slate-600">{body}</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                {REVIEW_CATEGORIES.map((c) => (
                  <li key={c.key} className="flex items-center justify-between">
                    <span>{c.label}</span>
                    <span className="font-bold text-slate-800">
                      {ratings[c.key] ?? "—"}/5
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>
                Back to editing
              </Button>
              <Button variant="primary" onClick={confirmPublish}>
                Confirm &amp; Publish Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
