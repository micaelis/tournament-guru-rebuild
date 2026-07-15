import Link from "next/link";
import type { Route } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import {
  Button,
  Card,
  EmptyState,
} from "@/app/components/ui";
import { safeImageSrc } from "@/lib/url";

/**
 * Attendee recent activity — the 50 most-recently-viewed events
 * (cap enforced by the trim_recently_viewed trigger).
 */
export default async function ActivityPage() {
  const { user } = await requireSessionAndProfile();
  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("recently_viewed")
    .select(
      "event_id, viewed_at, event:events!recently_viewed_event_id_fkey(id, title, host_club, location_formatted, start_date, end_date, logo_url)",
    )
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as unknown as {
    event_id: string;
    viewed_at: string;
    event: {
      id: string;
      title: string;
      host_club: string | null;
      location_formatted: string | null;
      start_date: string | null;
      end_date: string | null;
      logo_url: string | null;
    } | null;
  }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Activity
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your recently viewed events.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Visit an event and it'll show up here so you can find your way back."
          action={
            <Link href={"/events" as Route}>
              <Button>Browse events</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.event_id} className="p-4">
              {r.event ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Logo url={r.event.logo_url} title={r.event.title} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/events/${r.event.id}` as Route}
                      className="text-[15px] font-bold text-slate-900 hover:text-red-600"
                    >
                      {r.event.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {r.event.host_club && <>{r.event.host_club} · </>}
                      {r.event.location_formatted ?? "—"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(r.viewed_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Event removed.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Logo({
  url,
  title,
}: {
  url: string | null;
  title: string;
}) {
  const safe = safeImageSrc(url);
  return (
    <span className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-xl bg-slate-100">
      {safe ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safe} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-extrabold text-slate-500">
          {title[0]?.toUpperCase() ?? "T"}
        </span>
      )}
    </span>
  );
}
