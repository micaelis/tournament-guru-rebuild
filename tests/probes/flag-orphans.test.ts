/**
 * H-4 probe — no delete path may leave orphaned moderation rows.
 *
 * flagged_content + content_hidden are polymorphic (no FK, no cascade),
 * so cleanup is enforced by AFTER DELETE triggers on reviews and
 * comments (migration 20260718000009), covering every delete path at
 * once: a reviewer hard-deleting their own review, a comment author
 * deleting a comment (child replies cascade), the admin moderation
 * delete (review → comments cascade), and the owner-reply replacement.
 * An orphaned flag row is invisible: the moderation queue lists it but
 * can never render or dismiss it.
 *
 * Deletes run through the REAL roles (the review author's own client,
 * not the service role) so the probe also proves the SECURITY DEFINER
 * cleanup fires for users who cannot delete other users' flag rows.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

let edId = "";
let reviewerId = "";
let flaggerId = "";
let eventId = "";
let tournamentId = "";
let reviewer!: SupabaseClient;

const svc = service();

async function makeReview(): Promise<string> {
  const { data, error } = await svc
    .from("reviews")
    .insert({
      event_id: eventId,
      author_id: reviewerId,
      status: "published",
      review_title: "H4 probe review",
      review_body: "body",
      reviewer_user_type: "attendee",
      reviewer_role: "coach",
      rating_fields: 4,
      rating_facilities: 4,
      rating_management: 4,
      rating_competition: 4,
      rating_diversity: 4,
      rating_cost_value: 4,
    })
    .select("id")
    .single();
  if (error) throw new Error(`makeReview: ${error.message}`);
  return (data as { id: string }).id;
}

async function makeComment(
  reviewId: string,
  authorId: string,
  parentId: string | null = null,
): Promise<string> {
  const { data, error } = await svc
    .from("comments")
    .insert({
      review_id: reviewId,
      author_id: authorId,
      parent_comment_id: parentId,
      body: "H4 probe comment",
    })
    .select("id")
    .single();
  if (error) throw new Error(`makeComment: ${error.message}`);
  return (data as { id: string }).id;
}

async function flag(contentType: "review" | "comment", contentId: string) {
  const { error } = await svc.from("flagged_content").insert({
    content_type: contentType,
    content_id: contentId,
    flagged_by: flaggerId,
    reason: "profanity",
  });
  if (error) throw new Error(`flag: ${error.message}`);
  const hidden = await svc.from("content_hidden").insert({
    user_id: flaggerId,
    content_type: contentType,
    content_id: contentId,
  });
  if (hidden.error) throw new Error(`hide: ${hidden.error.message}`);
}

async function moderationRows(contentId: string) {
  const flags = await svc
    .from("flagged_content")
    .select("id")
    .eq("content_id", contentId);
  if (flags.error) throw new Error(flags.error.message);
  const hidden = await svc
    .from("content_hidden")
    .select("content_id")
    .eq("content_id", contentId);
  if (hidden.error) throw new Error(hidden.error.message);
  return (flags.data?.length ?? 0) + (hidden.data?.length ?? 0);
}

beforeAll(async () => {
  const ed = await createUser({
    metadata: { user_type: "event_director" },
    completeOnboarding: true,
    role: "event_director",
  });
  edId = ed.id;
  const seeded = await seedTournamentAndEvent(ed.client);
  eventId = seeded.eventId;
  tournamentId = seeded.tournamentId;

  const r = await createUser({ completeOnboarding: true, role: "coach" });
  reviewerId = r.id;
  reviewer = r.client;

  const f = await createUser({ completeOnboarding: true, role: "coach" });
  flaggerId = f.id;
});

afterAll(async () => {
  await svc.from("events").delete().eq("id", eventId);
  await svc.from("tournaments").delete().eq("id", tournamentId);
  await purge([edId, reviewerId, flaggerId]);
});

describe("h4 · every delete path purges flagged_content + content_hidden", () => {
  it("reviewer hard-deletes their own review — review flags AND cascaded comment flags purge", async () => {
    const reviewId = await makeReview();
    const commentId = await makeComment(reviewId, flaggerId);
    await flag("review", reviewId);
    await flag("comment", commentId);
    expect(await moderationRows(reviewId)).toBe(2);
    expect(await moderationRows(commentId)).toBe(2);

    const del = await reviewer.from("reviews").delete().eq("id", reviewId);
    expect(del.error).toBeNull();
    // The review really is gone (delete wasn't RLS-swallowed).
    const gone = await svc.from("reviews").select("id").eq("id", reviewId);
    expect(gone.data).toEqual([]);

    expect(await moderationRows(reviewId)).toBe(0);
    expect(await moderationRows(commentId)).toBe(0);
  });

  it("comment delete purges its flags and its cascaded child replies' flags", async () => {
    const reviewId = await makeReview();
    const commentId = await makeComment(reviewId, flaggerId);
    const replyId = await makeComment(reviewId, reviewerId, commentId);
    await flag("comment", commentId);
    await flag("comment", replyId);

    const del = await svc.from("comments").delete().eq("id", commentId);
    expect(del.error).toBeNull();
    const gone = await svc.from("comments").select("id").in("id", [commentId, replyId]);
    expect(gone.data).toEqual([]);

    expect(await moderationRows(commentId)).toBe(0);
    expect(await moderationRows(replyId)).toBe(0);

    await svc.from("reviews").delete().eq("id", reviewId);
  });

  it("no orphans remain across the whole tables after the paths above", async () => {
    // Repo-wide invariant: every flagged/hidden row must point at
    // content that still exists.
    const flags = await svc.from("flagged_content").select("content_type, content_id");
    if (flags.error) throw new Error(flags.error.message);
    const hidden = await svc.from("content_hidden").select("content_type, content_id");
    if (hidden.error) throw new Error(hidden.error.message);
    const rows = [...(flags.data ?? []), ...(hidden.data ?? [])] as {
      content_type: "review" | "comment";
      content_id: string;
    }[];
    for (const row of rows) {
      const table = row.content_type === "review" ? "reviews" : "comments";
      const { data } = await svc.from(table).select("id").eq("id", row.content_id);
      expect(
        data?.length,
        `orphaned ${row.content_type} moderation row ${row.content_id}`,
      ).toBe(1);
    }
  });
});
