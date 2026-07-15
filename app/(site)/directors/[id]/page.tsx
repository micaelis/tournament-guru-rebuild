import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { createAnonServerClient } from "@/lib/supabase/server";
import { safeImageSrc } from "@/lib/url";
import { StatusPill } from "@/app/components/ui";
import { deriveEventStatus } from "@/app/dashboard/events/event-shared";

type Params = { id: string };

/**
 * Public ED page — reads the `public_directors` view for identity
 * and the events table for the ED's active listings. Never returns
 * email / DOB / other PII.
 */
export default async function DirectorProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = createAnonServerClient();
  const [{ data: director }, { data: events }] = await Promise.all([
    supabase
      .from("public_directors")
      .select(
        "id, first_name, last_name, organization_title, org_logo_url, org_description, profile_photo_url",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("events")
      .select(
        "id, title, host_club, start_date, end_date, location_formatted, lifecycle, is_premium",
      )
      .eq("owner_id", id)
      .order("start_date", { ascending: true }),
  ]);
  if (!director) notFound();
  const d = director as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    org_logo_url: string | null;
    org_description: string | null;
    profile_photo_url: string | null;
  };
  const logo = safeImageSrc(d.org_logo_url ?? d.profile_photo_url);
  const name = d.organization_title ??
    [d.first_name, d.last_name].filter(Boolean).join(" ") ??
    "Director";
  const eventList = (events ?? []) as {
    id: string;
    title: string;
    host_club: string | null;
    start_date: string | null;
    end_date: string | null;
    location_formatted: string | null;
    lifecycle: "draft" | "active" | "canceled";
    is_premium: boolean;
  }[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start gap-5 rounded-2xl border border-slate-200 bg-white p-6">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="h-20 w-20 flex-none rounded-full object-cover"
          />
        ) : (
          <span className="grid h-20 w-20 flex-none place-items-center rounded-full bg-slate-100 text-xl font-bold text-slate-500">
            {name[0]?.toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
            {name}
          </h1>
          {d.first_name && d.organization_title && (
            <p className="mt-1 text-sm text-slate-500">
              Director: {d.first_name} {d.last_name}
            </p>
          )}
          {d.org_description && (
            <p className="mt-3 text-sm text-slate-700">{d.org_description}</p>
          )}
        </div>
      </header>

      <section className="mt-8">
        <h2 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
          Events
        </h2>
        {eventList.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No events published yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {eventList
              .filter((ev) => ev.lifecycle !== "draft")
              .map((ev) => {
                const status = deriveEventStatus(ev);
                return (
                  <li
                    key={ev.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400"
                  >
                    <Link
                      href={`/events/${ev.id}` as Route}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-[15px] font-bold text-slate-900">
                          {ev.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ev.host_club && <>{ev.host_club} · </>}
                          {ev.location_formatted ?? "Location TBD"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {ev.is_premium && (
                          <StatusPill tone="warning">Premium</StatusPill>
                        )}
                        <StatusPill
                          tone={status.toLowerCase() as
                            | "draft"
                            | "upcoming"
                            | "ongoing"
                            | "concluded"
                            | "canceled"}
                        >
                          {status}
                        </StatusPill>
                      </div>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </main>
  );
}
