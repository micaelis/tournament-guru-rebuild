import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { UsersTable, type UserRow } from "./UsersTable";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Admin Users page. Two tabs — Attendees / Event Directors — each
 * pulling from `profiles` scoped by user_type. Per-row action menu
 * (Block / Delete) routes through the admin_* RPCs.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") redirect("/dashboard/events");
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" ? sp.tab : "attendees") as
    | "attendees"
    | "eds";

  const supabase = await createServerAuthClient();
  const { data: users } = await supabase
    .from("profiles")
    .select(
      "id, user_type, role_title, first_name, last_name, dob, user_gender, location_formatted, organization_title, profile_photo_url, created_at, blocked",
    )
    .eq("user_type", tab === "attendees" ? "attendee" : "event_director")
    .order("created_at", { ascending: false });
  const rows = (users ?? []) as UserRow[];

  // Extra counts for the columns the spec calls out.
  const ids = rows.map((r) => r.id);
  const counts = new Map<string, { reviews: number; events: number; premium: number }>();
  if (ids.length) {
    if (tab === "attendees") {
      const { data: reviewCounts } = await supabase
        .from("reviews")
        .select("author_id")
        .in("author_id", ids)
        .eq("status", "published");
      for (const r of (reviewCounts ?? []) as { author_id: string }[]) {
        const bucket = counts.get(r.author_id) ?? {
          reviews: 0,
          events: 0,
          premium: 0,
        };
        bucket.reviews += 1;
        counts.set(r.author_id, bucket);
      }
    } else {
      const { data: eventCounts } = await supabase
        .from("events")
        .select("owner_id, is_premium")
        .in("owner_id", ids);
      for (const e of (eventCounts ?? []) as {
        owner_id: string;
        is_premium: boolean;
      }[]) {
        const bucket = counts.get(e.owner_id) ?? {
          reviews: 0,
          events: 0,
          premium: 0,
        };
        bucket.events += 1;
        if (e.is_premium) bucket.premium += 1;
        counts.set(e.owner_id, bucket);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Users
        </h1>
      </div>
      <div className="flex gap-2">
        {(
          [
            { key: "attendees", label: `Attendees` },
            { key: "eds", label: `Event Directors` },
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
      <UsersTable rows={rows} counts={counts} tab={tab} />
    </div>
  );
}
