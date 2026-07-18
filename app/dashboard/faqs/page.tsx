import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";
import { FaqsClient, type FaqRow } from "./FaqsClient";

export default async function FaqsAdminPage() {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") redirect("/dashboard/events");
  const supabase = await createServerAuthClient();
  // unwrap: a failed query must not render as an empty FAQ admin list.
  const data = unwrapRows(
    await supabase
      .from("faqs")
      .select(
        "id, title, content, status, is_visible, sort_order, created_at, faq_audiences(user_type, role_title)",
      )
      .order("sort_order", { ascending: true }),
    "FaqsAdminPage faqs",
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          FAQs
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Manage audience-targeted FAQ entries. Published + visible entries
          appear on attendee and ED dashboards.
        </p>
      </div>
      <FaqsClient rows={data as unknown as FaqRow[]} />
    </div>
  );
}
