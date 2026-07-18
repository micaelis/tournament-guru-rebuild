import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { EventForm, type EventFormDefaults } from "../../EventForm";
import { getEventForEdit, listSeasons } from "../../event-queries";

type Params = { id: string };

/**
 * Edit an existing event. The form accepts a full defaults blob so the
 * client component stays deterministic on first render (no post-mount
 * "loading" flicker on the child collections).
 */
export default async function EditEventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { profile, user } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") redirect("/events");

  const { id } = await params;
  const [payload, seasons] = await Promise.all([
    getEventForEdit(id),
    listSeasons(),
  ]);
  if (!payload) notFound();

  const canEdit =
    profile.user_type === "admin"
      ? true
      : payload.event.owner_id === user.id;
  if (!canEdit) redirect("/dashboard/events");

  const defaults: EventFormDefaults = {
    eventId: payload.event.id,
    tournamentId: payload.event.tournament_id,
    tournamentTitle: "",
    base: {
      title: payload.event.title ?? "",
      logo_url: payload.event.logo_url ?? "",
      website_url: payload.event.website_url ?? "",
      host_club: payload.event.host_club ?? "",
      start_date: payload.event.start_date ?? "",
      end_date: payload.event.end_date ?? "",
      registration_deadline: payload.event.registration_deadline ?? "",
      description: payload.event.description ?? "",
      location_formatted: payload.event.location_formatted ?? "",
      location_state_abbr: payload.event.location_state_abbr ?? "",
      location_lat:
        payload.event.location_lat !== null
          ? String(payload.event.location_lat)
          : "",
      location_lng:
        payload.event.location_lng !== null
          ? String(payload.event.location_lng)
          : "",
      location_place_id: payload.event.location_place_id ?? "",
      location_city: payload.event.location_city ?? "",
      location_state_full: payload.event.location_state_full ?? "",
      location_zip: payload.event.location_zip ?? "",
      num_teams_this_year:
        payload.event.num_teams_this_year !== null
          ? String(payload.event.num_teams_this_year)
          : "",
      region: payload.event.region ?? "",
      season_id: payload.event.season_id ?? "",
      video_url: payload.event.video_url ?? "",
      teams_this_year_url: payload.event.teams_this_year_url ?? "",
      teams_prev_year_url: payload.event.teams_prev_year_url ?? "",
      registration_url: payload.event.registration_url ?? "",
      teams_attended_prev_year:
        payload.event.teams_attended_prev_year !== null
          ? String(payload.event.teams_attended_prev_year)
          : "",
    },
    ageGroups: payload.ageGroups.map((g) => ({
      team_gender: g.team_gender,
      age: g.age,
      price: g.price,
      field_size: g.field_size,
    })),
    sponsors: payload.sponsors.map((s) => ({
      name: s.name,
      link: s.link,
      logo_url: s.logo_url,
    })),
    milestones: payload.milestones.map((m) => ({
      title: m.title,
      milestone_date: m.milestone_date ?? "",
      description: m.description ?? "",
    })),
    competitionLevels: payload.competitionLevels,
    surfaces: payload.surfaces,
    features: payload.features,
    images: payload.images.map((i) => i.url),
    lifecycle: payload.event.lifecycle,
    isPremium: payload.event.is_premium,
    seasons,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600">
            {payload.event.lifecycle === "draft"
              ? "Draft"
              : payload.event.lifecycle === "canceled"
                ? "Canceled"
                : "Published"}
          </p>
          <h1 className="mt-2 font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
            {payload.event.title || "Untitled event"}
          </h1>
        </div>
        <Link
          href={`/dashboard/events/${id}` as Route}
          className="text-sm font-semibold text-slate-700 underline"
        >
          Back to event details
        </Link>
      </div>
      <EventForm defaults={defaults} />
    </div>
  );
}
