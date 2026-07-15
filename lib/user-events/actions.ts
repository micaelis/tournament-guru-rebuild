"use server";

import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";

/** Toggle the caller's favorite mark on an event. Silent no-op for
 * anon visitors — the UI already gates the button. */
export async function toggleFavorite(
  eventId: string,
): Promise<{ error?: string; favorite?: boolean }> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to favorite events." };

  const { data: existing } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/favorites");
    revalidatePath(`/events/${eventId}`);
    return { favorite: false };
  }
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, event_id: eventId });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/favorites");
  revalidatePath(`/events/${eventId}`);
  return { favorite: true };
}

/**
 * Record a view of an event by the current user. Idempotent per
 * (user, event) via unique primary key + upsert — bumps viewed_at.
 * Cap trigger (migration 20260716000009) keeps the set at 50 rows
 * per user.
 */
export async function recordRecentView(eventId: string): Promise<void> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("recently_viewed")
    .upsert(
      {
        user_id: user.id,
        event_id: eventId,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" },
    );
}
