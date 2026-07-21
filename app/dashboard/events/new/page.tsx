import { notFound, redirect } from "next/navigation";
import { TextLink } from "@/app/components/ui";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { EventForm, type EventFormDefaults } from "../EventForm";
import { getTournamentForHeader, listSeasons } from "../event-queries";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * New Event form. Requires ?tournament=<id> — that assignment is what
 * ties the event to a tournament (spec: "assigned at creation"). If
 * the ED doesn't own the tournament we redirect back; admins can
 * create events under any unclaimed tournament they created.
 */
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, user } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") redirect("/events");

  const sp = await searchParams;
  const tournamentId = typeof sp.tournament === "string" ? sp.tournament : "";
  if (!tournamentId) redirect("/dashboard/events");

  const tournament = await getTournamentForHeader(tournamentId);
  if (!tournament) notFound();

  if (profile.user_type === "event_director" && tournament.owner_id !== user.id) {
    redirect("/dashboard/events");
  }
  if (profile.user_type === "admin" && tournament.owner_id !== null) {
    redirect("/dashboard/events");
  }

  const seasons = await listSeasons();

  const defaults: EventFormDefaults = {
    tournamentId: tournament.id,
    tournamentTitle: tournament.title,
    base: {
      title: "",
      logo_url: "",
      website_url: "",
      host_club: "",
      start_date: "",
      end_date: "",
      registration_deadline: "",
      description: "",
      location_formatted: "",
      location_state_abbr: "",
      location_lat: "",
      location_lng: "",
      location_place_id: "",
      location_city: "",
      location_state_full: "",
      location_zip: "",
      num_teams_this_year: "",
      region: "",
      season_id: seasons[0]?.id ?? "",
      video_url: "",
      teams_this_year_url: "",
      teams_prev_year_url: "",
      registration_url: "",
      teams_attended_prev_year: "",
    },
    ageGroups: [],
    sponsors: [],
    milestones: [],
    competitionLevels: [],
    surfaces: [],
    features: [],
    images: [],
    lifecycle: "draft",
    isPremium: false,
    seasons,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600">
            {tournament.title}
          </p>
          <h1 className="mt-2 font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
            Add Event
          </h1>
        </div>
        <TextLink href="/dashboard/events" className="text-sm">
          Back to events
        </TextLink>
      </div>
      <EventForm defaults={defaults} />
    </div>
  );
}
