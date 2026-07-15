import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { getEventForEdit } from "../event-queries";
import { EmptyState, Button } from "@/app/components/ui";

type Params = { id: string };

/**
 * Stub — the internal event details page lands in S1.3 (edit / delete
 * / duplicate / cancel actions + created/modified stamps). For now the
 * page confirms the event exists so the post-save redirect + Edit form
 * back-link route somewhere real instead of 404.
 */
export default async function EventDetailStub({
  params,
}: {
  params: Promise<Params>;
}) {
  await requireSessionAndProfile();
  const { id } = await params;
  const payload = await getEventForEdit(id);
  if (!payload) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600">
          Slice 1 · step 3
        </p>
        <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          {payload.event.title || "Untitled event"}
        </h1>
      </div>
      <EmptyState
        title="Internal event details coming in step 3"
        body="Duplicate, Copy link, Cancel-with-reason, and the full read-only view of the event's data land in the next commit. Editing is already live."
        action={
          <Link href={`/dashboard/events/${id}/edit` as Route}>
            <Button>Edit event</Button>
          </Link>
        }
        secondary={
          <Link href={"/dashboard/events" as Route}>
            <Button variant="ghost">Back to events</Button>
          </Link>
        }
      />
    </div>
  );
}
