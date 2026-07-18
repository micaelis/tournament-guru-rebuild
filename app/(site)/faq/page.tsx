import type { Metadata } from "next";
import { createAnonServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Frequently Asked Questions · Tournament Guru",
};

type FaqEntry = { id: string; title: string; content: string };

export default async function FaqPage() {
  const supabase = createAnonServerClient();
  const { data } = await supabase
    .from("faqs")
    .select("id, title, content")
    .eq("status", "published")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as unknown as FaqEntry[];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p
        className="text-center text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{ color: "var(--color-accent)" }}
      >
        FAQ
      </p>
      <h1
        className="font-heading mt-3 text-center"
        style={{
          fontSize: "clamp(28px, 4vw, 40px)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "var(--color-dark)",
        }}
      >
        Frequently Asked Questions
      </h1>
      <div className="mt-10 space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No FAQs published yet. Check back soon.
          </p>
        ) : (
          rows.map((r) => (
            <details
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <summary className="cursor-pointer text-[15px] font-bold text-slate-900">
                {r.title}
              </summary>
              <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-slate-700">
                {r.content}
              </p>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
