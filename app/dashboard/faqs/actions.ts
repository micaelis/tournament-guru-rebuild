"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { ATTENDEE_ROLES, ED_ROLES, USER_TYPES, enumOrNull } from "@/lib/enums";

export type FaqState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type AudienceInput = {
  user_type: string;
  role_title: string | null;
};

// The audience payload arrives as client-built JSON, so both fields
// re-validate against the enum allow-lists before insert (targetable
// audiences are attendee/ED — never admin).
const AUDIENCE_USER_TYPES = USER_TYPES.map((t) => t.value);
const AUDIENCE_ROLES = [
  ...ATTENDEE_ROLES.map((r) => r.value),
  ...ED_ROLES.map((r) => r.value),
];

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

function parseJson<T>(val: FormDataEntryValue | null): T | null {
  if (typeof val !== "string" || !val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function upsertFaq(
  _prev: FaqState,
  formData: FormData,
): Promise<FaqState> {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as "draft" | "published";
  const is_visible = formData.get("is_visible") === "on" || formData.get("is_visible") === "true";
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const audiences = parseJson<AudienceInput[]>(formData.get("audiences")) ?? [];

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Title required.";
  if (!content) fieldErrors.content = "Content required.";
  if (!["draft", "published"].includes(status)) fieldErrors.status = "Invalid status.";
  if (audiences.length === 0) fieldErrors.audiences = "Select at least one audience.";

  const audienceRows: {
    user_type: (typeof AUDIENCE_USER_TYPES)[number];
    role_title: (typeof AUDIENCE_ROLES)[number] | null;
  }[] = [];
  for (const a of audiences) {
    const user_type = enumOrNull(AUDIENCE_USER_TYPES, a.user_type);
    const role_title = enumOrNull(AUDIENCE_ROLES, a.role_title || null);
    if (!user_type || (a.role_title && !role_title)) {
      fieldErrors.audiences = "Invalid audience selection.";
      break;
    }
    audienceRows.push({ user_type, role_title });
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const { supabase, user } = await requireAdmin();

  let faqId = id;
  if (id) {
    const { error } = await supabase
      .from("faqs")
      .update({ title, content, status, is_visible, sort_order })
      .eq("id", id);
    if (error) return { error: error.message };

    // Replace-all targeting: a dropped delete leaves the old audiences
    // in place and the insert below stacks duplicates on top of them,
    // so the FAQ keeps showing to audiences the admin just removed.
    const { error: clearError } = await supabase
      .from("faq_audiences")
      .delete()
      .eq("faq_id", id);
    if (clearError) return { error: clearError.message };
  } else {
    const { data, error } = await supabase
      .from("faqs")
      .insert({ title, content, status, is_visible, sort_order, created_by: user.id })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Insert failed." };
    faqId = (data as { id: string }).id;
  }

  // Validation above guarantees at least one audience (with narrowed
  // enum values), so a dropped error here would report a saved FAQ
  // that is visible to nobody.
  const { error: audienceError } = await supabase.from("faq_audiences").insert(
    audienceRows.map((a) => ({ faq_id: faqId, ...a })),
  );
  if (audienceError) return { error: audienceError.message };

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
