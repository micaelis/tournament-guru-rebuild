import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";
import { fetchInChunks } from "@/lib/supabase/in-chunks";
import { unwrapRows } from "@/lib/supabase/unwrap";
import type { EventListRow } from "./event-shared";
export { deriveEventStatus, type EventListRow } from "./event-shared";

export type EventBaseRow = {
  id: string;
  tournament_id: string;
  owner_id: string | null;
  created_by: string | null;
  claimed: boolean;
  logo_url: string | null;
  title: string;
  website_url: string | null;
  host_club: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  description: string | null;
  location_formatted: string | null;
  location_state_abbr: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_place_id: string | null;
  location_city: string | null;
  location_state_full: string | null;
  location_zip: string | null;
  num_teams_this_year: number | null;
  region: "I" | "II" | "III" | "IV" | null;
  season_id: string | null;
  lifecycle: "draft" | "active" | "canceled";
  cancel_reason: string | null;
  is_premium: boolean;
  is_general_ad: boolean;
  premium_at: string | null;
  video_url: string | null;
  teams_this_year_url: string | null;
  teams_prev_year_url: string | null;
  registration_url: string | null;
  teams_attended_prev_year: number | null;
  would_return_pct: number | null;
  general_rating: number | null;
  coach_rating: number | null;
  attendee_rating: number | null;
  review_count: number;
  avg_fields: number | null;
  avg_facilities: number | null;
  avg_management: number | null;
  avg_competition: number | null;
  avg_diversity: number | null;
  avg_cost_value: number | null;
  created_at: string;
  updated_at: string;
};

export type AgeGroupRow = {
  id: string;
  event_id: string;
  team_gender: "boys" | "girls" | "both";
  age: string;
  price: number;
  field_size: string;
};

export type SponsorRow = {
  id: string;
  event_id: string;
  name: string;
  link: string;
  logo_url: string;
};

export type EventImageRow = {
  id: string;
  event_id: string;
  url: string;
  sort_order: number;
};

export type SeasonRow = { id: string; label: string; start_year: number };

const EVENT_BASE_COLUMNS =
  "id, tournament_id, owner_id, created_by, claimed, logo_url, title, website_url, host_club, start_date, end_date, registration_deadline, description, location_formatted, location_state_abbr, location_lat, location_lng, location_place_id, location_city, location_state_full, location_zip, num_teams_this_year, region, season_id, lifecycle, cancel_reason, is_premium, is_general_ad, premium_at, video_url, teams_this_year_url, teams_prev_year_url, registration_url, teams_attended_prev_year, would_return_pct, general_rating, coach_rating, attendee_rating, review_count, avg_fields, avg_facilities, avg_management, avg_competition, avg_diversity, avg_cost_value, created_at, updated_at";

/**
 * Fetches an event and its child data in parallel. Returns null if the
 * event isn't visible to the caller (either wrong id or RLS denied).
 */
export type MilestoneRow = {
  title: string;
  milestone_date: string | null;
  description: string | null;
  sort_order: number;
};

export async function getEventForEdit(eventId: string): Promise<{
  event: EventBaseRow;
  ageGroups: AgeGroupRow[];
  sponsors: SponsorRow[];
  images: EventImageRow[];
  milestones: MilestoneRow[];
  competitionLevels: string[];
  surfaces: string[];
  features: string[];
} | null> {
  const supabase = await createServerAuthClient();

  const [
    eventRes,
    ageGroupsRes,
    sponsorsRes,
    imagesRes,
    milestonesRes,
    levelsRes,
    surfacesRes,
    featuresRes,
  ] = await Promise.all([
    supabase.from("events").select(EVENT_BASE_COLUMNS).eq("id", eventId).maybeSingle(),
    supabase.from("event_age_groups").select("*").eq("event_id", eventId),
    supabase.from("sponsors").select("*").eq("event_id", eventId),
    supabase.from("event_images").select("*").eq("event_id", eventId).order("sort_order"),
    supabase.from("event_milestones").select("title, milestone_date, description, sort_order").eq("event_id", eventId).order("sort_order"),
    supabase.from("event_competition_levels").select("level").eq("event_id", eventId),
    supabase.from("event_surfaces").select("surface").eq("event_id", eventId),
    supabase.from("event_features").select("feature").eq("event_id", eventId),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  if (!eventRes.data) return null;

  // unwrap the child reads too: a failed child query would load the
  // edit form with an empty section, and the replace-all save would
  // then persist that emptiness as a deletion.
  return {
    event: eventRes.data as unknown as EventBaseRow,
    ageGroups: unwrapRows(ageGroupsRes, "getEventForEdit ageGroups") as unknown as AgeGroupRow[],
    sponsors: unwrapRows(sponsorsRes, "getEventForEdit sponsors") as unknown as SponsorRow[],
    images: unwrapRows(imagesRes, "getEventForEdit images") as unknown as EventImageRow[],
    milestones: unwrapRows(milestonesRes, "getEventForEdit milestones") as unknown as MilestoneRow[],
    competitionLevels: unwrapRows<{ level: string }>(
      levelsRes,
      "getEventForEdit levels",
    ).map((r) => r.level),
    surfaces: unwrapRows<{ surface: string }>(
      surfacesRes,
      "getEventForEdit surfaces",
    ).map((r) => r.surface),
    features: unwrapRows<{ feature: string }>(
      featuresRes,
      "getEventForEdit features",
    ).map((r) => r.feature),
  };
}

/** All seasons sorted newest-first for the season picker. */
export async function listSeasons(): Promise<SeasonRow[]> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, label, start_year")
    .order("start_year", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SeasonRow[];
}

/** Owner + tournament title, for the header of the Add/Edit form. */
export async function getTournamentForHeader(
  tournamentId: string,
): Promise<{ id: string; title: string; owner_id: string | null } | null> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, title, owner_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as {
    id: string;
    title: string;
    owner_id: string | null;
  } | null;
}

const EVENT_LIST_COLUMNS =
  "id, tournament_id, title, description, host_club, start_date, end_date, lifecycle, is_premium, is_general_ad, owner_id, season_id, location_formatted, general_rating, attendee_rating, review_count, avg_fields, avg_facilities, avg_management, avg_competition, avg_diversity, avg_cost_value";

/**
 * Lists events under one or more tournaments for the dashboard. Sort:
 * soonest start_date first (spec: "sorted by start-date, the soonest
 * displayed at the top"). Drafts float to the top of their tournament
 * because their start_date is often null.
 */
export async function listEventsForTournaments(
  tournamentIds: string[],
): Promise<EventListRow[]> {
  if (tournamentIds.length === 0) return [];
  const supabase = await createServerAuthClient();
  // Admin scope passes EVERY tournament id — batch the .in() and
  // restore the global sort across batches.
  const rows = await fetchInChunks(tournamentIds, async (chunk) => {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_LIST_COLUMNS)
      .in("tournament_id", chunk)
      .order("start_date", { ascending: true, nullsFirst: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as EventListRow[];
  });
  rows.sort((a, b) => {
    const av = a.start_date ?? "";
    const bv = b.start_date ?? "";
    if (av === bv) return 0;
    if (av === "") return -1;
    if (bv === "") return 1;
    return av < bv ? -1 : 1;
  });
  return rows;
}

