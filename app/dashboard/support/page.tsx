import { requireSessionAndProfile } from "@/lib/supabase/session";
import { SupportForm } from "./SupportForm";
import { createServerAuthClient } from "@/lib/supabase/server";

/**
 * Support hub. Contact form + audience-scoped FAQ list.
 *
 * Mirrors the `/dashboard/faq` query: entries must be both published
 * and visible, and audience targeting comes from the `faq_audiences`
 * child table (a null `role_title` targets the whole user type). The
 * filter runs server-side, so only matching rows reach the client.
 */
export default async function SupportPage() {
  const { profile, user } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("id, title, content, faq_audiences!inner(user_type, role_title)")
    .eq("status", "published")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  // Surface the failure instead of rendering an empty list that looks
  // like "no FAQs yet" — a swallowed error here hid a dropped-column
  // regression for an entire release.
  if (error) throw new Error(`Support FAQ query failed: ${error.message}`);

  const faqs = ((data ?? []) as unknown as {
    id: string;
    title: string;
    content: string;
    faq_audiences: { user_type: string; role_title: string | null }[];
  }[]).filter((f) =>
    f.faq_audiences.some(
      (a) =>
        a.user_type === profile.user_type &&
        (a.role_title === null || a.role_title === profile.role_title),
    ),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          Support
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Get in touch and let us know how we can help.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,_1fr)_400px]">
        <div>
          <h2 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
            Frequently Asked
          </h2>
          {faqs.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              We&apos;ll add answers here soon. Meanwhile drop us a note on the
              right.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {faqs.map((f) => (
                <details
                  key={f.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <summary className="cursor-pointer text-[14px] font-bold text-slate-900">
                    {f.title}
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                    {f.content}
                  </p>
                </details>
              ))}
            </div>
          )}
        </div>
        <SupportForm
          defaultEmail={user.email ?? ""}
          defaultName={
            [profile.first_name, profile.last_name].filter(Boolean).join(" ")
          }
        />
      </div>
    </div>
  );
}
