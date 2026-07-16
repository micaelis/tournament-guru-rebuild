import { requireSessionAndProfile } from "@/lib/supabase/session";
import { SupportForm } from "./SupportForm";
import { createServerAuthClient } from "@/lib/supabase/server";

/**
 * Support hub. Contact form + audience-scoped FAQ list. FAQ RLS is
 * public-read; we filter by audience client-side because the list is
 * small.
 */
export default async function SupportPage() {
  const { profile, user } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("faqs")
    .select("id, title, body, audience, sort_order")
    .order("sort_order", { ascending: true });
  const audienceKey =
    profile.user_type === "attendee"
      ? "attendee"
      : profile.user_type === "event_director"
        ? "event_director"
        : "both";
  const faqs = ((data ?? []) as {
    id: string;
    title: string;
    body: string;
    audience: "attendee" | "event_director" | "both";
    sort_order: number;
  }[]).filter(
    (f) => f.audience === audienceKey || f.audience === "both",
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
                    {f.body}
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
