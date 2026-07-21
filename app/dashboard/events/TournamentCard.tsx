"use client";

import Link from "next/link";
import { useState } from "react";
import type { Route } from "next";
import {
  Button,
  Card,
  EmptyState,
  MetricStrip,
  type MetricTileData,
} from "@/app/components/ui";
import {
  DeleteTournamentButton,
  EditTournamentDialog,
} from "./TournamentDialogs";
import type { TournamentRow } from "./queries";
import { EventList } from "./EventList";
import type { EventListRow } from "./event-shared";

/**
 * A single tournament card on the Events page. Header shows title +
 * inline Edit/Delete; body shows the metric strip (only when the
 * tournament has at least one review); below is the events slot which
 * S1.3 populates with rows and a per-event metric strip.
 */
export function TournamentCard({
  tournament,
  events,
  seasons,
  canManage,
  manageableEventIds,
  showEventsByDefault,
  ownerName,
  isAdmin,
}: {
  tournament: TournamentRow;
  events: EventListRow[];
  seasons: Map<string, string>;
  canManage: boolean;
  // Serializable list (not a function) so this client component's props can
  // cross the server→client boundary; the predicate is rebuilt below.
  manageableEventIds: string[];
  showEventsByDefault: boolean;
  ownerName?: string;
  isAdmin?: boolean;
}) {
  const eventCount = events.length;
  const [editing, setEditing] = useState(false);
  const [showEvents, setShowEvents] = useState(showEventsByDefault);

  const tiles = buildTournamentTiles(tournament);
  const hasReviews = tournament.review_count > 0;

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
            {tournament.title}
          </h2>
          <p className="mt-1 text-[12px] font-medium text-slate-400">
            {eventCount === 0
              ? "No events yet"
              : `${eventCount} ${eventCount === 1 ? "event" : "events"}`}
            {tournament.recurring ? " · Recurring" : ""}
            {hasReviews
              ? ` · ${tournament.review_count} ${tournament.review_count === 1 ? "review" : "reviews"}`
              : ""}
            {isAdmin && (
              <>
                {" · "}
                {ownerName ? (
                  <span className="text-slate-700">Owner: {ownerName}</span>
                ) : (
                  <span className="text-red-600">Unclaimed</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={
              `/dashboard/events/new?tournament=${tournament.id}` as Route
            }
          >
            <Button size="sm">+ Add event</Button>
          </Link>
          {canManage && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <DeleteTournamentButton
                tournamentId={tournament.id}
                tournamentTitle={tournament.title}
              />
            </>
          )}
        </div>
      </header>

      {hasReviews && (
        <div className="border-b border-slate-100 p-5">
          <MetricStrip tiles={tiles} title="Tournament ratings" />
        </div>
      )}

      <div className="p-5">
        {eventCount === 0 ? (
          <EmptyState
            title="No events yet"
            body="Add the first event under this tournament — dates, location, age groups, and sponsors go on the event, not the tournament."
            action={
              <Link
                href={
                  `/dashboard/events/new?tournament=${tournament.id}` as Route
                }
              >
                <Button>+ Add event</Button>
              </Link>
            }
          />
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-800">Events</p>
              <button
                type="button"
                onClick={() => setShowEvents((s) => !s)}
                aria-expanded={showEvents}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-400"
              >
                {showEvents ? "Hide" : "Show"}
              </button>
            </div>
            {showEvents && (
              <div className="mt-3">
                <EventList
                  events={events}
                  seasons={seasons}
                  canManage={(ev) => manageableEventIds.includes(ev.id)}
                  isAdmin={isAdmin}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <EditTournamentDialog
          open={editing}
          onClose={() => setEditing(false)}
          tournament={{
            id: tournament.id,
            title: tournament.title,
            recurring: tournament.recurring,
          }}
        />
      )}
    </Card>
  );
}

/**
 * Build the 9-tile tournament strip (Overall, Coach, Attendee, then
 * the 6 category averages). Nulls render as "—" tiles.
 */
function buildTournamentTiles(t: TournamentRow): MetricTileData[] {
  return [
    { label: "Overall", value: t.general_rating, count: t.review_count },
    { label: "Coach", value: t.coach_rating, count: t.review_count },
    { label: "Attendee", value: t.attendee_rating, count: t.review_count },
    { label: "Fields", value: t.avg_fields, count: t.review_count },
    { label: "Facilities", value: t.avg_facilities, count: t.review_count },
    { label: "Management", value: t.avg_management, count: t.review_count },
    { label: "Competition", value: t.avg_competition, count: t.review_count },
    { label: "Diversity", value: t.avg_diversity, count: t.review_count },
    { label: "Cost / value", value: t.avg_cost_value, count: t.review_count },
  ];
}
