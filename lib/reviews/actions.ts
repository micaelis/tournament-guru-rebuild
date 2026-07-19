"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { fetchBannedWords, findBannedWords } from "./banned-words";
import type { Database } from "@/lib/database.types";
import {
  REVIEW_BODY_MAX,
  REVIEW_CATEGORIES,
  isReviewStillEditable,
  needsWouldReturn,
} from "./shared";

export type ReviewState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  bannedHits?: string[];
  savedId?: string;
};

const CATEGORY_KEYS = REVIEW_CATEGORIES.map((c) => c.key);

/**
 * Create or update a review, either as a draft (fewer constraints)
 * or published (full validation + banned-word check + one-per-event
 * enforcement). The unique index `reviews_one_per_author_event`
 * backstops the one-per-event rule at the DB layer; we check
 * upfront here so the form can redirect the user to their existing
 * row instead of surfacing a 23505.
 */
export async function saveReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const intent = String(formData.get("intent") ?? "draft") as "draft" | "publish";
  const eventId = String(formData.get("event_id") ?? "");
  const reviewId = String(formData.get("review_id") ?? "");
  const promoId = String(formData.get("promo_id") ?? "") || null;

  if (!eventId) return { error: "Missing event." };

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type, role_title")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");
  if (profile.user_type !== "attendee") {
    return { error: "Only attendees can publish reviews." };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, end_date")
    .eq("id", eventId)
    .maybeSingle<{ id: string; end_date: string | null }>();
  if (!event) return { error: "Event not found." };

  const values = collectReviewValues(formData);
  const fieldErrors: Record<string, string> = {};

  // Text length gate — applied to both draft + publish so we never
  // store an oversize body (matches the schema's "review_body" text
  // column's UX cap).
  if (values.review_body.length > REVIEW_BODY_MAX) {
    fieldErrors.review_body = `You've exceeded the ${REVIEW_BODY_MAX} character limit.`;
  }

  if (intent === "publish") {
    for (const key of CATEGORY_KEYS) {
      if (values[key] === null || values[key] === undefined) {
        fieldErrors[key] =
          "To submit your review, please select a rating for all the categories above.";
      }
    }
    if (!values.review_title.trim()) {
      fieldErrors.review_title = "To submit your review, please include a title.";
    }
    if (!values.review_body.trim()) {
      fieldErrors.review_body =
        "To submit your review, please add a few details about your experience.";
    }
    if (
      needsWouldReturn(profile.role_title) &&
      (values.would_return === null || values.would_return === undefined)
    ) {
      fieldErrors.would_return =
        "Coaches and team managers: let attendees know whether you'd return.";
    }
  }

  // Banned-word check runs on both title + body. Fires even on drafts
  // so the user gets immediate feedback in the form.
  const bannedList = await fetchBannedWords();
  const bannedHits = Array.from(
    new Set([
      ...findBannedWords(values.review_title, bannedList),
      ...findBannedWords(values.review_body, bannedList),
    ]),
  );
  if (bannedHits.length && intent === "publish") {
    fieldErrors.review_body =
      "Your review contains words we don't allow. Update them and try again.";
  }

  if (Object.keys(fieldErrors).length) {
    return { fieldErrors, bannedHits };
  }

  // Look for an existing review for this (user, event). One-per-event
  // is a unique index; upsert by explicit id keeps the update path
  // deterministic.
  let targetId = reviewId;
  if (!targetId) {
    const existingReview = await supabase
      .from("reviews")
      .select("id")
      .eq("event_id", eventId)
      .eq("author_id", user.id)
      .maybeSingle<{ id: string }>();
    // A dropped error here reads as "no review yet" and routes an EDIT
    // down the INSERT branch, where it dies on the one-per-event unique
    // index with a raw DB message.
    if (existingReview.error) return { error: existingReview.error.message };
    targetId = existingReview.data?.id ?? "";
  }

  const row: Database["public"]["Tables"]["reviews"]["Insert"] = {
    event_id: eventId,
    author_id: user.id,
    status: intent === "publish" ? "published" : "draft",
    review_title: values.review_title || null,
    review_body: values.review_body || null,
    would_return: needsWouldReturn(profile.role_title) ? values.would_return : null,
    rating_fields: values.rating_fields,
    rating_facilities: values.rating_facilities,
    rating_management: values.rating_management,
    rating_competition: values.rating_competition,
    rating_diversity: values.rating_diversity,
    rating_cost_value: values.rating_cost_value,
    reviewer_user_type: profile.user_type,
    reviewer_role: profile.role_title,
  };

  if (!targetId) {
    // First time — INSERT. The reviews grant only permits the columns
    // we're writing here (no guru_review / promo_id / published_at).
    const { data, error } = await supabase
      .from("reviews")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };
    if (promoId && intent === "publish") {
      const rpc = await supabase.rpc("apply_promo_to_review", {
        p_review: data.id,
        p_promo: promoId,
      });
      if (rpc.error) return { error: rpc.error.message };
    }
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/dashboard/reviews`);
    return { savedId: data.id };
  }

  // Editing an existing review — enforce edit window on published
  // rows so a user can't sneak edits in months later.
  if (event.end_date && !isReviewStillEditable(event.end_date)) {
    // Draft rows are always editable regardless of the window.
    const { data: existing, error: statusError } = await supabase
      .from("reviews")
      .select("status")
      .eq("id", targetId)
      .maybeSingle<{ status: "draft" | "published" }>();
    // Fail closed: a dropped error would skip the lock entirely and let
    // the update below write through the closed edit window.
    if (statusError) return { error: statusError.message };
    if (existing?.status === "published") {
      return {
        error:
          "This event ended over 30 days ago — published reviews are locked from further edits.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("reviews")
    .update(row)
    .eq("id", targetId);
  if (updateError) return { error: updateError.message };
  if (promoId && intent === "publish") {
    const rpc = await supabase.rpc("apply_promo_to_review", {
      p_review: targetId,
      p_promo: promoId,
    });
    if (rpc.error) return { error: rpc.error.message };
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/dashboard/reviews`);
  return { savedId: targetId };
}

function collectReviewValues(fd: FormData) {
  const readRating = (k: string): number | null => {
    const raw = String(fd.get(k) ?? "");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const rawWouldReturn = String(fd.get("would_return") ?? "");
  const would_return =
    rawWouldReturn === "yes" ? true : rawWouldReturn === "no" ? false : null;
  return {
    review_title: String(fd.get("review_title") ?? "").trim(),
    review_body: String(fd.get("review_body") ?? "").trim(),
    rating_fields: readRating("rating_fields"),
    rating_facilities: readRating("rating_facilities"),
    rating_management: readRating("rating_management"),
    rating_competition: readRating("rating_competition"),
    rating_diversity: readRating("rating_diversity"),
    rating_cost_value: readRating("rating_cost_value"),
    would_return,
  };
}

/**
 * Hard-delete a review. Spec exception: the reviews-stay rule
 * ("preserve reviews and their comments") does NOT apply to the
 * reviewer's own delete — they can wipe their content entirely. The
 * platform_counters gauge is deliberately never decremented (spec:
 * "even if the published review was deleted, the system should
 * still count it towards the total nr of published reviews").
 */
export async function deleteReview(reviewId: string): Promise<ReviewState> {
  const supabase = await createServerAuthClient();
  const { data: review } = await supabase
    .from("reviews")
    .select("event_id, author_id")
    .eq("id", reviewId)
    .maybeSingle<{ event_id: string | null; author_id: string | null }>();
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/reviews`);
  if (review?.event_id) revalidatePath(`/events/${review.event_id}`);
  return {};
}

/**
 * Toggle the current user's helpful mark on a review. Uses upsert +
 * delete against the review_helpful table; the trigger keeps
 * reviews.helpful_count in sync.
 */
export async function toggleHelpful(
  reviewId: string,
): Promise<ReviewState & { helpful?: boolean }> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to mark reviews helpful." };

  const { data: existing } = await supabase
    .from("review_helpful")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("review_id", reviewId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("review_helpful")
      .delete()
      .eq("user_id", user.id)
      .eq("review_id", reviewId);
    if (error) return { error: error.message };
    return { helpful: false };
  }
  const { error } = await supabase
    .from("review_helpful")
    .insert({ user_id: user.id, review_id: reviewId });
  if (error) return { error: error.message };
  return { helpful: true };
}

/**
 * Flag a review or comment. Reason is one of the four enum values;
 * `additional_info` is required when reason='other' (spec). After
 * insert, we hide the row for this flagger via content_hidden so it
 * never re-surfaces to them.
 */
export async function flagContent(input: {
  contentType: "review" | "comment";
  contentId: string;
  reason: "profanity" | "illicit" | "solicitation" | "other";
  additionalInfo: string;
}): Promise<ReviewState> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to flag content." };

  if (input.reason === "other" && !input.additionalInfo.trim()) {
    return {
      fieldErrors: {
        additional_info: "Tell us a little more so we can review this.",
      },
    };
  }

  const { error } = await supabase.from("flagged_content").insert({
    content_type: input.contentType,
    content_id: input.contentId,
    flagged_by: user.id,
    reason: input.reason,
    additional_info: input.additionalInfo.trim() || null,
  });
  if (error) return { error: error.message };

  // The flag landed; if the hide-for-me row does not, the content the
  // user just reported keeps reappearing in their own feed.
  const { error: hideError } = await supabase.from("content_hidden").upsert({
    user_id: user.id,
    content_type: input.contentType,
    content_id: input.contentId,
  });
  if (hideError) return { error: hideError.message };

  revalidatePath("/dashboard/reviews");
  return {};
}

/**
 * Add or edit a comment. Enforces the spec rules:
 * - Only attendees + the event's owner ED can post; other EDs / admins
 *   from unrelated orgs can't (admin can DELETE via a separate action).
 * - Owner ED gets one pinned reply per review; that row carries
 *   is_owner_reply=true.
 * - The banned-word check runs against the body.
 */
export async function saveComment(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const reviewId = String(formData.get("review_id") ?? "");
  const commentId = String(formData.get("comment_id") ?? "");
  const parentId = String(formData.get("parent_comment_id") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim();

  if (!reviewId) return { error: "Missing review." };
  if (!body) return { fieldErrors: { body: "Add a comment first." } };
  if (body.length > REVIEW_BODY_MAX) {
    return {
      fieldErrors: { body: `Comments cap at ${REVIEW_BODY_MAX} characters.` },
    };
  }

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to comment." };

  const bannedList = await fetchBannedWords();
  const bannedHits = findBannedWords(body, bannedList);
  if (bannedHits.length) {
    return {
      fieldErrors: {
        body: "Your comment contains words we don't allow. Update them and try again.",
      },
      bannedHits,
    };
  }

  // Fetch review + related event owner for the permission gate.
  const { data: review } = await supabase
    .from("reviews")
    .select("id, event_id, author_id, status")
    .eq("id", reviewId)
    .maybeSingle<{
      id: string;
      event_id: string | null;
      author_id: string | null;
      status: "draft" | "published";
    }>();
  if (!review || review.status !== "published") {
    return { error: "This review isn't open for comments." };
  }
  if (review.author_id === user.id) {
    return { error: "You can't comment on your own review." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
  if (!profile) return { error: "Sign in to comment." };

  let isOwnerReply = false;
  if (profile.user_type !== "attendee") {
    // Only the event's owning ED can comment as the owner-reply; other
    // EDs / admins can't post from an unrelated org.
    if (!review.event_id) return { error: "Comments are only open on live events." };
    const { data: event } = await supabase
      .from("events")
      .select("owner_id")
      .eq("id", review.event_id)
      .maybeSingle<{ owner_id: string | null }>();
    if (!event || event.owner_id !== user.id) {
      return { error: "Only the event's Director can reply here." };
    }
    isOwnerReply = true;
  }

  if (isOwnerReply && !commentId) {
    // Enforce "one pinned reply" — if a prior owner reply exists,
    // delete it first, per spec ("Allow the ED to delete their reply
    // and add a new one").
    const { error: priorReplyError } = await supabase
      .from("comments")
      .delete()
      .eq("review_id", reviewId)
      .eq("author_id", user.id)
      .eq("is_owner_reply", true);
    // Unchecked, a failure here leaves the old reply in place and the
    // insert below creates a second one, breaking one-pinned-reply.
    if (priorReplyError) return { error: priorReplyError.message };
  }

  if (commentId) {
    const { error } = await supabase
      .from("comments")
      .update({ body })
      .eq("id", commentId)
      .eq("author_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("comments").insert({
      review_id: reviewId,
      author_id: user.id,
      parent_comment_id: parentId,
      body,
      is_owner_reply: isOwnerReply,
    });
    if (error) return { error: error.message };
  }

  if (review.event_id) revalidatePath(`/events/${review.event_id}`);
  revalidatePath("/dashboard/reviews");
  return {};
}

/**
 * Delete a comment. The comment's author can always delete their own.
 * Admins can delete any comment (spec: "the admin should be able to
 * delete comments too"). RLS enforces the same in p_comments_delete.
 */
export async function deleteComment(commentId: string): Promise<ReviewState> {
  const supabase = await createServerAuthClient();
  const { data: comment } = await supabase
    .from("comments")
    .select("review_id, reviews:review_id(event_id)")
    .eq("id", commentId)
    .maybeSingle<{
      review_id: string;
      reviews: { event_id: string | null } | null;
    }>();
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { error: error.message };
  if (comment?.reviews?.event_id) {
    revalidatePath(`/events/${comment.reviews.event_id}`);
  }
  revalidatePath("/dashboard/reviews");
  return {};
}

/**
 * Admin-only edit of a review — allows fixing title / body / any of
 * the 6 category ratings. Column allow-list already gates who can
 * write to review columns via RLS/grants; this action just wraps the
 * write with an admin check so we can surface a friendly error.
 */
export async function adminEditReview(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const reviewId = String(formData.get("review_id") ?? "");
  if (!reviewId) return { error: "Missing review." };

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
  if (profile?.user_type !== "admin") {
    return { error: "Only admins can edit other users' reviews here." };
  }

  const values = collectReviewValues(formData);
  const bannedList = await fetchBannedWords();
  const bannedHits = Array.from(
    new Set([
      ...findBannedWords(values.review_title, bannedList),
      ...findBannedWords(values.review_body, bannedList),
    ]),
  );
  if (bannedHits.length) {
    return {
      fieldErrors: {
        review_body: "That contains banned words; please fix them first.",
      },
      bannedHits,
    };
  }
  const { error } = await supabase
    .from("reviews")
    .update({
      review_title: values.review_title,
      review_body: values.review_body,
      rating_fields: values.rating_fields,
      rating_facilities: values.rating_facilities,
      rating_management: values.rating_management,
      rating_competition: values.rating_competition,
      rating_diversity: values.rating_diversity,
      rating_cost_value: values.rating_cost_value,
    })
    .eq("id", reviewId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/reviews");
  return { savedId: reviewId };
}
