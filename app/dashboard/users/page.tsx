import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";
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
  const search = typeof sp.search === "string" ? sp.search.trim() : "";

  const supabase = await createServerAuthClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, user_type, role_title, first_name, last_name, dob, user_gender, location_formatted, organization_title, profile_photo_url, created_at, blocked",
    )
    .eq("user_type", tab === "attendees" ? "attendee" : "event_director");

  // Name / organization / email search. Strip characters that would
  // break the PostgREST `or()` grammar before interpolating the term.
  // Emails live in auth.users, which this client can't read, so the
  // admin-only definer RPC resolves the term to matching user ids and
  // those fold into the same or(). unwrap: a failed lookup must not
  // silently degrade to name-only results.
  const safe = search.replace(/[,()%*\\]/g, " ").trim();
  if (safe) {
    const emailIds = unwrapRows<string>(
      await supabase.rpc("admin_search_users_by_email", { term: safe }),
      "AdminUsersPage email search",
    );
    const emailArm = emailIds.length ? `,id.in.(${emailIds.join(",")})` : "";
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,organization_title.ilike.%${safe}%${emailArm}`,
    );
  }

  // unwrap: a failed query must not render as "no users".
  const rows = unwrapRows<UserRow>(
    await query.order("created_at", { ascending: false }),
    "AdminUsersPage profiles",
  );

  // Extra counts for the columns the spec calls out.
  const ids = rows.map((r) => r.id);
  const counts = new Map<string, { reviews: number; events: number; premium: number }>();
  if (ids.length) {
    if (tab === "attendees") {
      const reviewCounts = unwrapRows(
        await supabase
          .from("reviews")
          .select("author_id")
          .in("author_id", ids)
          .eq("status", "published"),
        "AdminUsersPage review counts",
      );
      for (const r of reviewCounts) {
        if (!r.author_id) continue;
        const bucket = counts.get(r.author_id) ?? {
          reviews: 0,
          events: 0,
          premium: 0,
        };
        bucket.reviews += 1;
        counts.set(r.author_id, bucket);
      }
    } else {
      const eventCounts = unwrapRows(
        await supabase
          .from("events")
          .select("owner_id, is_premium")
          .in("owner_id", ids),
        "AdminUsersPage event counts",
      );
      for (const e of eventCounts) {
        if (!e.owner_id) continue;
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
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
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
      <form method="get" className="flex max-w-md gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input
          type="search"
          name="search"
          defaultValue={search}
          aria-label="Search users"
          placeholder="Search by name, email, or organization…"
          className="tg-control"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Search
        </button>
      </form>
      <UsersTable rows={rows} counts={counts} tab={tab} />
    </div>
  );
}
