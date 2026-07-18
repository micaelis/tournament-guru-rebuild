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
 * Delete the flagged content (review or comment). Spec: "delete the
 * review's comments, all the flagged content entries linked to this
 * review and their comments" — the comments go via FK cascade, and
 * every flagged_content / content_hidden row goes via the AFTER DELETE
 * triggers on reviews and comments (20260718000009). The old app-side
 * cleanup here covered only this one path and missed child replies;
 * the triggers cover every delete path at once.
 */
export async function deleteFlaggedContent(
  contentType: "review" | "comment",
  contentId: string,
): Promise<FlaggedState> {
  const { supabase } = await requireAdmin();
  const table = contentType === "review" ? "reviews" : "comments";
  const { error } = await supabase.from(table).delete().eq("id", contentId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/flagged");
  return {};
}
