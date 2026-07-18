"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";

export type FlaggedState = { error?: string; info?: string };

async function requireAdmin() {
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
    throw new Error("Admins only.");
  }
  return { supabase };
}

/**
 * Clear all flag records for a piece of content (Dismiss). The
 * content itself stays; the entry disappears from the moderation
 * queue.
 */
export async function dismissFlags(
  contentType: "review" | "comment",
  contentId: string,
): Promise<FlaggedState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("flagged_content")
    .delete()
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/flagged");
  return {};
}

/**
 * Delete the flagged content (review or comment) plus its flags. For
 * reviews we also delete their comments (spec: "delete the review's
 * comments, all the flagged content entries linked to this review
 * and their comments"). For comments we just delete the row.
 */
export async function deleteFlaggedContent(
  contentType: "review" | "comment",
  contentId: string,
): Promise<FlaggedState> {
  const { supabase } = await requireAdmin();
  // Clear the flags first so the trigger cascade doesn't drop them
  // before we're done reading.
  await supabase
    .from("flagged_content")
    .delete()
    .eq("content_type", contentType)
    .eq("content_id", contentId);

  if (contentType === "review") {
    // Delete flagged_content for this review's comments (polymorphic, no FK cascade).
    const { data: comments } = await supabase
      .from("comments")
      .select("id")
      .eq("review_id", contentId);
    if (comments?.length) {
      await supabase
        .from("flagged_content")
        .delete()
        .eq("content_type", "comment")
        .in("content_id", comments.map((c) => c.id));
    }
    const { error } = await supabase.from("reviews").delete().eq("id", contentId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("comments").delete().eq("id", contentId);
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/flagged");
  return {};
}
