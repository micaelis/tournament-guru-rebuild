import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { FaqsClient, type FaqRow } from "./FaqsClient";

/**
 * Admin FAQ CRUD. RLS on `faqs` allows public reads + admin writes,
 * so we just fetch + hand off to the client for the edit surface.
 */
export default async function FaqsAdminPage() {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") redirect("/dashboard/events");
  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("faqs")
    .select("id, title, body, audience, sort_order, created_at")
    .order("sort_order", { ascending: true });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          FAQs
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Manage the questions shown to each audience under Support.
        </p>
      </div>
      <FaqsClient rows={(data ?? []) as FaqRow[]} />
    </div>
  );
}
