"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";

export type FaqState = {
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
    .maybeSingle<{ user_type: string }>();
  if (profile?.user_type !== "admin") {
    throw new Error("Admins only.");
  }
  return { supabase, user };
}

export async function upsertFaq(
  _prev: FaqState,
  formData: FormData,
): Promise<FaqState> {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "both") as
    | "attendee"
    | "event_director"
    | "both";
  const sort_order = Number(formData.get("sort_order") ?? 0);

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Title required.";
  if (!body) fieldErrors.body = "Body required.";
  if (!["attendee", "event_director", "both"].includes(audience)) {
    fieldErrors.audience = "Invalid audience.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { supabase, user } = await requireAdmin();
  if (id) {
    const { error } = await supabase
      .from("faqs")
      .update({ title, body, audience, sort_order })
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("faqs")
      .insert({ title, body, audience, sort_order, created_by: user.id });
    if (error) return { error: error.message };
  }
  revalidatePath("/dashboard/faqs");
  return {};
}

export async function deleteFaq(id: string): Promise<FaqState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/faqs");
  return {};
}
