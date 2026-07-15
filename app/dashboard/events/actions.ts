"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  createdId?: string;
};

/**
 * Create a tournament. Assigns owner = caller (an ED). Admins that
 * create-on-behalf leave owner_id null (see spec: unclaimed events);
 * the admin variant of this action uses `createTournamentAsAdmin`.
 */
export async function createTournament(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const title = String(formData.get("title") ?? "").trim();
  const recurring = formData.get("recurring") === "on";

  if (!title) return { fieldErrors: { title: "Tournament title is required." } };

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
  if (!profile || profile.user_type === "attendee") {
    return { error: "You don't have permission to create a tournament." };
  }

  const owner_id = profile.user_type === "event_director" ? user.id : null;

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      title,
      recurring,
      owner_id,
      created_by: user.id,
      claimed: owner_id !== null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/events");
  return { createdId: data.id };
}

/**
 * Rename a tournament / toggle recurring. Callers only reach this on
 * tournaments they own (or via admin path).
 */
export async function updateTournament(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const recurring = formData.get("recurring") === "on";

  if (!id) return { error: "Missing tournament id." };
  if (!title) return { fieldErrors: { title: "Tournament title is required." } };

  const supabase = await createServerAuthClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ title, recurring })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/events");
  return {};
}

/**
 * Delete a tournament. Uses the SECURITY DEFINER `delete_tournament`
 * RPC, which iterates the child events + detaches reviews (they stay
 * as snapshots per SCHEMA-DESIGN §9 and the ED spec's "reviews stay"
 * rule) before removing the tournament row.
 */
export async function deleteTournament(id: string): Promise<ActionState> {
  if (!id) return { error: "Missing tournament id." };
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("delete_tournament", {
    target_tournament: id,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/events");
  return {};
}
