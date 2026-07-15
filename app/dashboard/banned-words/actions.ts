"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";

export type BannedWordState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

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
  return { supabase, userId: user.id };
}

export async function addBannedWord(
  _prev: BannedWordState,
  formData: FormData,
): Promise<BannedWordState> {
  const word = String(formData.get("word") ?? "").trim();
  if (!word) return { fieldErrors: { word: "Type a word to add." } };
  if (word.length > 40)
    return { fieldErrors: { word: "Keep it under 40 characters." } };

  const { supabase, userId } = await requireAdmin();
  const { error } = await supabase
    .from("banned_words")
    .insert({ word, created_by: userId });
  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { word: "That word is already on the list." } };
    }
    return { error: error.message };
  }
  revalidatePath("/dashboard/banned-words");
  return {};
}

export async function deleteBannedWord(id: string): Promise<BannedWordState> {
  if (!id) return { error: "Missing id." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("banned_words").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/banned-words");
  return {};
}

export async function updateBannedWord(
  id: string,
  nextWord: string,
): Promise<BannedWordState> {
  if (!id) return { error: "Missing id." };
  const word = nextWord.trim();
  if (!word) return { fieldErrors: { word: "Word can't be empty." } };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("banned_words")
    .update({ word })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/banned-words");
  return {};
}
