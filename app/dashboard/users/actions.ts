"use server";

import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "@/lib/supabase/server";

export type UserAdminState = { error?: string };

export async function setBlocked(
  userId: string,
  blocked: boolean,
): Promise<UserAdminState> {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("admin_set_blocked", {
    target_user: userId,
    is_blocked: blocked,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/users");
  return {};
}

export async function deleteUser(userId: string): Promise<UserAdminState> {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("admin_delete_user", {
    target_user: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/users");
  return {};
}
