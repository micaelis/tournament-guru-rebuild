import Link from "next/link";
import type { Route } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { EmptyState, Button } from "@/app/components/ui";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Stub — the Add Event form itself ships in S1.2. This route exists
 * so the "Add first event" prompt + tournament card CTAs don't 404.
 */
export default async function NewEventStub({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSessionAndProfile();
  const sp = await searchParams;
  const tournamentId = typeof sp.tournament === "string" ? sp.tournament : "";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600">
          Slice 1 · step 2
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Add event
        </h1>
        {tournamentId && (
          <p className="mt-2 text-xs text-slate-500">
            Tournament ID:{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              {tournamentId}
            </code>
          </p>
        )}
      </div>
      <EmptyState
        title="Event form coming in step 2"
        body="The full Add/Edit Event form — logo, dates, description, location, age groups, sponsors, competition levels, surfaces — lands in the next commit. Save-as-draft, publish validation, and the internal event detail page follow in step 3."
        secondary={
          <Link href={"/dashboard/events" as Route}>
            <Button variant="ghost">Back to events</Button>
          </Link>
        }
      />
    </div>
  );
}
