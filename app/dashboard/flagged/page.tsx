import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { FlaggedContent, type FlaggedGroup } from "./FlaggedContent";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Admin Flagged Content — two tabs (Reviews / Comments) with cards
 * grouped by content. Each group carries the flags cast against it
 * so the admin can see who reported and why before deciding.
 */
export default async function FlaggedContentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") redirect("/dashboard/events");
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" ? sp.tab : "reviews") as
    | "reviews"
    | "comments";

  const supabase = await createServerAuthClient();
  const { data: flags } = await supabase
    .from("flagged_content")
    .select(
      "id, content_type, content_id, reason, additional_info, created_at, flagged_by, flagger:profiles!flagged_content_flagged_by_fkey(first_name, last_name, profile_photo_url)",
    )
    .eq("content_type", tab === "reviews" ? "review" : "comment")
    .order("created_at", { ascending: false });
  const flagRows = (flags ?? []) as unknown as Array<{
    id: string;
    content_type: "review" | "comment";
    content_id: string;
    reason: string;
    additional_info: string | null;
    created_at: string;
    flagged_by: string | null;
    flagger: {
      first_name: string | null;
      last_name: string | null;
      profile_photo_url: string | null;
    } | null;
  }>;

  const grouped = new Map<string, typeof flagRows>();
  for (const f of flagRows) {
    const list = grouped.get(f.content_id) ?? [];
    list.push(f);
    grouped.set(f.content_id, list);
  }
  const contentIds = Array.from(grouped.keys());
  const contents: FlaggedGroup[] = [];

  if (tab === "reviews" && contentIds.length) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select(
        "id, event_id, author_id, review_title, review_body, published_at, created_at, event:events!reviews_event_id_fkey(id, title, logo_url), author:profiles!reviews_author_id_fkey(first_name, last_name, profile_photo_url)",
      )
      .in("id", contentIds);
    for (const r of (reviews ?? []) as unknown as Array<{
      id: string;
      event_id: string | null;
      author_id: string | null;
      review_title: string | null;
      review_body: string | null;
      published_at: string | null;
      created_at: string;
      event: { id: string; title: string; logo_url: string | null } | null;
      author: {
        first_name: string | null;
        last_name: string | null;
        profile_photo_url: string | null;
      } | null;
    }>) {
      contents.push({
        contentType: "review",
        contentId: r.id,
        title: r.review_title,
        body: r.review_body,
        published_at: r.published_at ?? r.created_at,
        eventTitle: r.event?.title ?? null,
        eventId: r.event?.id ?? null,
        eventLogo: r.event?.logo_url ?? null,
        author: r.author,
        flags: grouped.get(r.id) ?? [],
      });
    }
  } else if (contentIds.length) {
    const { data: comments } = await supabase
      .from("comments")
      .select(
        "id, review_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(first_name, last_name, profile_photo_url), review:reviews!comments_review_id_fkey(id, review_title, event_id, event:events!reviews_event_id_fkey(id, title))",
      )
      .in("id", contentIds);
    for (const c of (comments ?? []) as unknown as Array<{
      id: string;
      review_id: string;
      author_id: string | null;
      body: string;
      created_at: string;
      author: {
        first_name: string | null;
        last_name: string | null;
        profile_photo_url: string | null;
      } | null;
      review: {
        id: string;
        review_title: string | null;
        event_id: string | null;
        event: { id: string; title: string } | null;
      } | null;
    }>) {
      contents.push({
        contentType: "comment",
        contentId: c.id,
        title: c.review?.review_title ?? null,
        body: c.body,
        published_at: c.created_at,
        eventTitle: c.review?.event?.title ?? null,
        eventId: c.review?.event?.id ?? null,
        eventLogo: null,
        author: c.author,
        flags: grouped.get(c.id) ?? [],
      });
    }
  }

  contents.sort((a, b) => b.published_at.localeCompare(a.published_at));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          Flagged Content
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Community-reported reviews + comments. Dismiss clears the flags;
          Delete removes the content.
        </p>
      </div>
      <div className="flex gap-2">
        {(
          [
            { key: "reviews", label: "Reviews" },
            { key: "comments", label: "Comments" },
          ] as const
        ).map((t) => {
          const active = tab === t.key;
          return (
            <a
              key={t.key}
              href={`?tab=${t.key}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </div>
      <FlaggedContent groups={contents} tab={tab} />
    </div>
  );
}
