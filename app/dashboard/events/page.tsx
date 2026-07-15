import { requireSessionAndProfile } from "@/lib/supabase/session";
import { WelcomeCard } from "./WelcomeCard";
import { TournamentCard } from "./TournamentCard";
import { EventsToolbar } from "./EventsToolbar";
import { FirstRunAddButton } from "./FirstRunAddButton";
import {
  fetchTournamentOwnerNames,
  listTournaments,
  type TournamentSort,
} from "./queries";
import {
  listEventsForTournaments,
  listSeasons,
  type EventListRow,
} from "./event-queries";

type SearchParams = { [key: string]: string | string[] | undefined };

const VALID_SORTS: TournamentSort[] = [
  "title_asc",
  "created_desc",
  "created_asc",
  "rating_desc",
  "rating_asc",
  "reviews_desc",
  "reviews_asc",
  "owner_asc",
  "owner_desc",
];

/**
 * ED / Admin Events landing. When the user has no tournaments they
 * see the WelcomeCard (empty state); as soon as at least one exists
 * they see the searchable / sortable list of TournamentCards. Admin
 * sees the same page scoped to all tournaments (RLS lets them read
 * everyone's); the admin-only columns + CSV + QR ship in S1.5.
 */
export default async function EventsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, user } = await requireSessionAndProfile();
  const sp = await searchParams;
  const scope: "own" | "all" = profile.user_type === "admin" ? "all" : "own";

  const search = typeof sp.q === "string" ? sp.q : "";
  const sortRaw = typeof sp.sort === "string" ? sp.sort : "title_asc";
  const sort = (VALID_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as TournamentSort)
    : "title_asc";

  const isAdmin = profile.user_type === "admin";
  const tournaments = await listTournaments({
    userId: user.id,
    scope,
    search,
    sort,
  });
  const [events, seasons, ownerNames] = await Promise.all([
    listEventsForTournaments(tournaments.map((t) => t.id)),
    listSeasons(),
    isAdmin
      ? fetchTournamentOwnerNames(
          Array.from(
            new Set(
              tournaments
                .map((t) => t.owner_id)
                .filter((v): v is string => Boolean(v)),
            ),
          ),
        )
      : Promise.resolve(new Map<string, string>()),
  ]);
  const seasonLabels = new Map(seasons.map((s) => [s.id, s.label]));
  const eventsByTournament = new Map<string, EventListRow[]>();
  for (const ev of events) {
    const bucket = eventsByTournament.get(ev.tournament_id) ?? [];
    bucket.push(ev);
    eventsByTournament.set(ev.tournament_id, bucket);
  }

  const isEmptyFirstRun =
    tournaments.length === 0 && !search && profile.user_type !== "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          {profile.user_type === "admin" ? "All events" : "Your events"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {profile.user_type === "admin"
            ? "Every tournament on the platform, in one place."
            : "Manage your tournaments and the events under them."}
        </p>
      </div>

      {isEmptyFirstRun ? (
        <WelcomeCard
          firstName={profile.first_name ?? ""}
          onAddTournament={<FirstRunAddButton />}
        />
      ) : (
        <>
          <EventsToolbar
            initialSearch={search}
            initialSort={sort}
            showAdd={profile.user_type !== "attendee"}
            isAdmin={isAdmin}
            hasResults={tournaments.length > 0}
          />
          {tournaments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              No tournaments matched &quot;{search}&quot;.
            </p>
          ) : (
            <div className="space-y-6">
              {tournaments.map((t) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  events={eventsByTournament.get(t.id) ?? []}
                  seasons={seasonLabels}
                  canManage={canManageTournament(profile.user_type, t, user.id)}
                  canManageEvent={(ev) =>
                    canManageEvent(profile.user_type, ev, user.id)
                  }
                  showEventsByDefault={!isAdmin}
                  ownerName={
                    isAdmin && t.owner_id ? ownerNames.get(t.owner_id) : undefined
                  }
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Admin can only manage tournaments they created AND that are not yet
 * claimed by an ED (spec: "the option to edit the tournament/add an
 * event is possible for the admin only if the tournament/event was
 * added by the admin and has not yet been claimed by an ED"). EDs can
 * always manage their own.
 */
function canManageTournament(
  userType: "attendee" | "event_director" | "admin",
  tournament: { owner_id: string | null; created_by: string | null },
  userId: string,
): boolean {
  if (userType === "event_director") return tournament.owner_id === userId;
  if (userType === "admin") {
    if (tournament.owner_id) return false; // claimed by an ED
    return tournament.created_by === userId || tournament.created_by === null;
  }
  return false;
}

/**
 * Admin can edit any event (spec: "editing an event should be possible
 * for the admin in either case") but can only delete/duplicate ones
 * they created and that no ED has claimed. EDs manage everything they
 * own. The permissions here mirror EventActions' render gating.
 */
function canManageEvent(
  userType: "attendee" | "event_director" | "admin",
  event: EventListRow,
  userId: string,
): boolean {
  if (userType === "event_director") return event.owner_id === userId;
  if (userType === "admin") return true;
  return false;
}
