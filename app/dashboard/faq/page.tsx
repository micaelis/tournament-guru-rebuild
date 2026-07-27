import Link from "next/link";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";
import { deriveFaqTopic, FAQ_TOPICS, type FaqTopicId } from "@/lib/faq/topics";
import { Button, HeaderCountChip } from "@/app/components/ui";
import { Icon } from "../icons";
import { FaqViewer } from "./FaqViewer";

export type FaqViewRow = {
  id: string;
  title: string;
  content: string;
  topic: FaqTopicId;
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
    topic: deriveFaqTopic(f.title),
  }));

  const topicCount = FAQ_TOPICS.filter((t) =>
    rows.some((r) => r.topic === t.id),
  ).length;

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-2">
          <h1 className="font-[var(--font-heading)] text-2xl font-extrabold tracking-tight text-slate-900">
            FAQ
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <HeaderCountChip
              icon={<Icon name="chat" className="h-3 w-3" />}
              count={rows.length}
              label={rows.length === 1 ? "answer" : "answers"}
            />
            <HeaderCountChip
              icon={<Icon name="layers" className="h-3 w-3" />}
              count={topicCount}
              label={topicCount === 1 ? "topic" : "topics"}
            />
          </div>
        </div>
        <a href="#faq-support">
          <Button variant="secondary" size="sm">
            <Icon name="lifebuoy" className="h-4 w-4 text-slate-500" />
            Contact support
          </Button>
        </a>
      </div>
      <p className="mt-1 text-[13px] font-medium text-slate-500">
        Quick answers about events, reviews, and your account — or search for
        exactly what you need.
      </p>

      <FaqViewer rows={rows} />

      <section
        id="faq-support"
        aria-label="Contact support"
        className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_34px_-22px_rgba(15,23,42,0.18)] md:p-7"
      >
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <Icon name="lifebuoy" className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-[var(--font-heading)] text-[16.5px] font-extrabold tracking-tight text-slate-900">
              Still need help?
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Didn&rsquo;t find your answer? Send us a note — a real person
              replies within one business day.
            </p>
          </div>
          <Link href="/dashboard/support" className="flex-none">
            <Button variant="accent">
              <Icon name="mail" className="h-4 w-4 opacity-90" />
              Contact support
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
