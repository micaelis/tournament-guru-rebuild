import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";
import { FaqViewer } from "./FaqViewer";

export type FaqViewRow = {
  id: string;
  title: string;
  content: string;
};

export default async function DashboardFaqPage() {
  const { profile } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();

  // unwrap: a failed query must not render as an empty FAQ list — that
  // exact masquerade shipped the broken Support page (C-2).
  const data = unwrapRows<{
    id: string;
    title: string;
    content: string;
    faq_audiences: { user_type: string; role_title: string | null }[];
  }>(
    await supabase
      .from("faqs")
      .select("id, title, content, faq_audiences!inner(user_type, role_title)")
      .eq("status", "published")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }),
    "DashboardFaqPage faqs",
  );

  const filtered = data.filter((faq) =>
    faq.faq_audiences.some(
      (a) =>
        a.user_type === profile.user_type &&
        (a.role_title === null || a.role_title === profile.role_title),
    ),
  );

  const rows: FaqViewRow[] = filtered.map((f) => ({
    id: f.id,
    title: f.title,
    content: f.content,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          FAQ
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Answers to the questions we hear most.
        </p>
      </div>
      <FaqViewer rows={rows} />
    </div>
  );
}
