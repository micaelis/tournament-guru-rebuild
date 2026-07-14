import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getEventById,
  getEventReviews,
  getParentTournamentReviews,
  getEventAgeGroups,
  getEventSponsors,
  getOtherEventsByOwner,
  getDirectorProfile,
  getEventProfile,
} from "@/lib/supabase/queries";
import { EventDetail } from "./parts";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) return { title: "Event · Tournament Guru" };
  const loc = event.location_text?.trim() || event.state || null;
  return {
    title: `${event.title} · Tournament Guru`,
    description:
      event.description?.slice(0, 160) ??
      `Real reviews and details for ${event.title}${loc ? ` in ${loc}` : ""}.`,
  };
}

/* ─────────────────────────────────────────────────────────────────
   Public event page — single scroll, no tabs. Two-column layout on
   ≥lg: left column is the content stream (gallery, key facts, about,
   age groups, key dates, location, reviews, sponsors, other events by
   this org); right column is the sticky Contact Host panel.

   Data model reminders (schema, not Bubble):
     • events.event_profile_id → event_profiles.id is the recurring
       tournament parent — sibling events share it. That's where the
       "future event with no reviews of its own" fallback comes from.
     • Reviews filter is `published = true` (not a status enum).
     • Coach vs Attendee split is `user_role ilike '%coach%'` —
       matches the recalc trigger + review-counts RPC.
     • Author badge fields belong on `review_author_badges` (SECURITY
       DEFINER view); the base `profiles` table is RLS-locked.
   ───────────────────────────────────────────────────────────────── */
export default async function EventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  // Everything else in one wave — none of these depend on each other.
  const [
    ownReviews,
    ageGroups,
    sponsors,
    otherEvents,
    director,
    parentProfile,
  ] = await Promise.all([
    getEventReviews(id),
    getEventAgeGroups(id),
    getEventSponsors(id),
    getOtherEventsByOwner(event.owner_id ?? null, id, 4),
    event.owner_id ? getDirectorProfile(event.owner_id) : Promise.resolve(null),
    getEventProfile(event.event_profile_id ?? null),
  ]);

  // Only fetch parent-tournament reviews when the current event is
  // future AND has zero published reviews of its own AND has a parent.
  // Keeps the extra roundtrip out of the hot path for concluded events.
  const isFuture = isEventFuture(event.start_date, event.end_date);
  const shouldFallback =
    isFuture && ownReviews.length === 0 && !!event.event_profile_id;
  const fallbackReviews = shouldFallback
    ? await getParentTournamentReviews(
        event.event_profile_id ?? null,
        id,
        20,
      )
    : [];

  return (
    <EventDetail
      event={event}
      ownReviews={ownReviews}
      fallbackReviews={fallbackReviews}
      usingFallback={shouldFallback && fallbackReviews.length > 0}
      ageGroups={ageGroups}
      sponsors={sponsors}
      otherEvents={otherEvents}
      director={director}
      parentProfile={parentProfile}
    />
  );
}

function isEventFuture(
  start: string | null,
  end: string | null,
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const anchor = end ?? start;
  if (!anchor) return false;
  const d = new Date(anchor);
  if (Number.isNaN(d.getTime())) return false;
  return d >= today;
}
