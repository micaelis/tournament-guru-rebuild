import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAnonServerClient, createServerAuthClient } from "@/lib/supabase/server";
import { unwrap } from "@/lib/supabase/unwrap";
import { legacyStatus } from "@/lib/events/status";
import {
  getUserHelpfulSet,
  listCommentsForReview,
  listReviewsForEvent,
} from "@/lib/reviews/queries";
import { fetchBannedWords } from "@/lib/reviews/banned-words";
import { recordRecentView } from "@/lib/user-events/actions";
import { hasPendingClaim } from "@/lib/claims/queries";
import {
  getDirectorProfile,
  getDirectorEventRows,
} from "@/lib/directors/queries";
import type {
  EventDetailRow,
  EventAgeGroupRow,
  SponsorRow,
} from "@/app/components/types";
import { EventDetail } from "./parts";

type Params = { id: string };

const EVENT_SELECT =
  "id, tournament_id, owner_id, title, description, host_club, logo_url, website_url, start_date, end_date, registration_deadline, location_formatted, location_state_abbr, num_teams_this_year, teams_attended_prev_year, teams_this_year_url, teams_prev_year_url, registration_url, region, lifecycle, is_premium, is_general_ad, cancel_reason, would_return_pct, general_rating, coach_rating, attendee_rating, review_count, updated_at, event_age_groups(id, age, team_gender, price, field_size), event_competition_levels(level), event_surfaces(surface), event_images(url, sort_order), sponsors(id, name, link, logo_url)";

type RawEvent = {
  id: string;
  tournament_id: string | null;
  owner_id: string | null;
  title: string;
  description: string | null;
  host_club: string | null;
  logo_url: string | null;
  website_url: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  location_formatted: string | null;
  location_state_abbr: string | null;
  num_teams_this_year: number | null;
  teams_attended_prev_year: number | null;
  teams_this_year_url: string | null;
  teams_prev_year_url: string | null;
  registration_url: string | null;
  region: string | null;
  lifecycle: "draft" | "active" | "canceled";
  is_premium: boolean;
  is_general_ad: boolean;
  cancel_reason: string | null;
  would_return_pct: number | null;
  general_rating: number | null;
  coach_rating: number | null;
  attendee_rating: number | null;
  review_count: number;
  updated_at: string | null;
  event_age_groups: {
    id: string;
    age: string | null;
    team_gender: string | null;
    price: number | null;
    field_size: string | null;
  }[] | null;
  event_competition_levels: { level: string | null }[] | null;
  event_surfaces: { surface: string | null }[] | null;
  event_images: { url: string; sort_order: number | null }[] | null;
  sponsors: { id: string; name: string; link: string; logo_url: string }[] | null;
};

async function loadEvent(id: string): Promise<RawEvent | null> {
  const supabase = createAnonServerClient();
  // unwrap: a query failure must throw — otherwise it would notFound()
  // a live event. Null data (event truly absent/draft) still 404s.
  const { data } = unwrap(
    await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("id", id)
      .neq("lifecycle", "draft")
      .maybeSingle(),
    "loadEvent",
  );
  return (data as RawEvent | null) ?? null;
}

function toDetailRow(ev: RawEvent, hostLogo: string | null): EventDetailRow {
  const ages = Array.from(
    new Set((ev.event_age_groups ?? []).map((g) => g.age).filter(Boolean)),
  ) as string[];
  const genders = Array.from(
    new Set((ev.event_age_groups ?? []).map((g) => g.team_gender).filter(Boolean)),
  ) as string[];
  const levels = Array.from(
    new Set((ev.event_competition_levels ?? []).map((g) => g.level).filter(Boolean)),
  ) as string[];
  const surfaces = Array.from(
    new Set((ev.event_surfaces ?? []).map((g) => g.surface).filter(Boolean)),
  ) as string[];
  const photos = [...(ev.event_images ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i) => i.url);
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    host_club: ev.host_club,
    location_text: ev.location_formatted,
    state: ev.location_state_abbr,
    start_date: ev.start_date,
    end_date: ev.end_date,
    status: legacyStatus(ev),
    premium: ev.is_premium,
    spotlight: ev.is_general_ad,
    logo: ev.logo_url,
    owner_id: ev.owner_id,
    host_logo: hostLogo,
    general_rating: ev.general_rating,
    coach_rating: ev.coach_rating,
    attendee_rating: ev.attendee_rating,
    reviews: ev.review_count,
    would_return_pct: ev.would_return_pct,
    nr_teams_last_year: ev.teams_attended_prev_year ?? ev.num_teams_this_year,
    created_at: ev.updated_at ?? new Date(0).toISOString(),
    region: ev.region,
    event_ages: ages.map((age) => ({ age })),
    event_genders: genders.map((gender) => ({ gender })),
    event_competition_levels: levels.map((level) => ({ level })),
    event_fields: surfaces.map((surface) => ({ surface })),
    // detail extras
    event_director: ev.host_club,
    event_profile_id: ev.tournament_id,
    registration_deadline: ev.registration_deadline,
    website: ev.website_url,
    this_year_website: ev.teams_this_year_url,
    previous_year_website: ev.teams_prev_year_url,
    registration_link: ev.registration_url,
    qr_code: null,
    photos,
    updated_at: ev.updated_at,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const ev = await loadEvent(id);
  if (!ev) return { title: "Event not found — Tournament Guru" };
  const where = [ev.location_formatted, ev.location_state_abbr]
    .filter(Boolean)
    .join(", ");
  return {
    title: `${ev.title} — Tournament Guru`,
    description:
      ev.description?.slice(0, 155) ??
      `${ev.title}${where ? ` in ${where}` : ""} on Tournament Guru.`,
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const ev = await loadEvent(id);
  if (!ev) notFound();

  const supabaseAuth = await createServerAuthClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  const [director, otherEvents, reviews, bannedWords] = await Promise.all([
    ev.owner_id ? getDirectorProfile(ev.owner_id) : Promise.resolve(null),
    ev.owner_id
      ? getDirectorEventRows(ev.owner_id, { excludeEventId: id, limit: 4 })
      : Promise.resolve([]),
    listReviewsForEvent(id),
    fetchBannedWords(),
  ]);

  if (user) {
    // Fire-and-forget recently-viewed log — don't block render.
    void recordRecentView(id);
  }

  const [commentsByReviewArr, helpfulSet, isAdmin] = await Promise.all([
    Promise.all(
      reviews.map(async (r) => ({
        id: r.id,
        comments: await listCommentsForReview(r.id),
      })),
    ),
    user
      ? getUserHelpfulSet(
          user.id,
          reviews.map((r) => r.id),
        )
      : Promise.resolve(new Set<string>()),
    (async () => {
      if (!user) return false;
      const { data } = await supabaseAuth
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
      return data?.user_type === "admin";
    })(),
  ]);

  const commentsByReview: Record<string, (typeof commentsByReviewArr)[number]["comments"]> =
    {};
  for (const c of commentsByReviewArr) commentsByReview[c.id] = c.comments;

  // Favorite state + claim CTA state — reuse the rebuild's Favorite/Claim
  // flow inside main's restored header. Claim mirrors the spec: claimed
  // (owner set) hides the CTA; anon → signup; an ED with a pending claim →
  // "Requested"; otherwise → requestable.
  const favoritedRes = user
    ? await supabaseAuth
        .from("favorites")
        .select("event_id")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .maybeSingle()
    : { data: null };
  const favorited = Boolean(favoritedRes.data);

  const claimState: "anon" | "requestable" | "requested" | "claimed" = ev.owner_id
    ? "claimed"
    : !user
      ? "anon"
      : await (async () => {
          const { data: p } = await supabaseAuth
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle<{ user_type: string }>();
          if (p?.user_type !== "event_director") return "claimed" as const;
          const has = ev.tournament_id
            ? await hasPendingClaim(user.id, ev.tournament_id)
            : false;
          return has ? ("requested" as const) : ("requestable" as const);
        })();

  const detail = toDetailRow(ev, director?.org_logo ?? null);
  const ageGroups: EventAgeGroupRow[] = (ev.event_age_groups ?? []).map((g) => ({
    id: g.id,
    age: g.age,
    gender: g.team_gender,
    label: g.field_size,
    price: g.price,
    age_index: null,
  }));
  const sponsors: SponsorRow[] = (ev.sponsors ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    logo: s.logo_url,
    link: s.link,
  }));

  return (
    <EventDetail
      event={detail}
      reviews={reviews}
      commentsByReview={commentsByReview}
      helpfulReviewIds={Array.from(helpfulSet)}
      currentUserId={user?.id ?? null}
      isAdmin={isAdmin}
      bannedWords={bannedWords}
      ageGroups={ageGroups}
      sponsors={sponsors}
      otherEvents={otherEvents}
      director={director}
      favorited={favorited}
      claimState={claimState}
    />
  );
}
