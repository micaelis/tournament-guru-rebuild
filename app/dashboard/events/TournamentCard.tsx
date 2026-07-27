"use client";

import Link from "next/link";
import { useState } from "react";
import type { Route } from "next";
import { Button, StarRating, cn } from "@/app/components/ui";
import { Icon } from "@/app/dashboard/icons";
import { EditTournamentDialog } from "./TournamentDialogs";
import type { TournamentRow } from "./queries";
import { EventList } from "./EventList";
import { RatingsBreakdown } from "./RatingsBreakdown";
import {
  EVENT_GRID_CLASS,
  LIST_CARD_CLASS,
  breakdownLinkClass,
  deriveEventStatus,
  matchesStatusFilter,
  type EventListRow,
  type EventStatusFilter,
} from "./event-shared";

/**
 * A single tournament card on the Events page: eyebrow + title +
 * Recurring tag, one compact meta line (event count · average ·
 * verified reviews · the collapsed-by-default ratings breakdown),
 * tournament-level actions packed right, then the dense events table.
 * Deleting the tournament lives inside the Edit dialog — the card
 * itself only carries the two approved actions.
 */
export function TournamentCard({
  tournament,
  events,
  seasons,
  statusFilter,
  canManage,
  manageableEventIds,
  showEventsByDefault,
  ownerName,
  isAdmin,
}: {
  tournament: TournamentRow;
  events: EventListRow[];
  seasons: Map<string, string>;
  statusFilter: EventStatusFilter;
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
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const visibleEvents =
    statusFilter === "all"
      ? events
      : events.filter((ev) =>
          matchesStatusFilter(deriveEventStatus(ev), statusFilter),
        );
  const hasReviews = tournament.review_count > 0;
  const hasPremiumEvent = events.some((ev) => ev.is_premium);

  return (
    <section className={LIST_CARD_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            Tournament
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="font-[var(--font-heading)] text-[16.5px] font-extrabold tracking-tight text-slate-900 [text-wrap:balance]">
              {tournament.title}
            </h2>
            {tournament.recurring && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                <Icon name="refresh" className="h-3 w-3 text-slate-400" />
                Recurring
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-slate-500">
            <span>
              <span className="font-bold text-slate-800">{eventCount}</span>{" "}
              {eventCount === 1 ? "event" : "events"}
            </span>
            {hasReviews ? (
              <>
                <MetaDot />
                <span className="inline-flex items-center gap-1.5">
                  <StarRating
                    value={tournament.general_rating ?? 0}
                    size={12}
                    showNumber={false}
                  />
                  <span className="font-[var(--font-heading)] text-[13px] font-extrabold text-slate-900">
                    {(tournament.general_rating ?? 0).toFixed(2)}
                  </span>
                </span>
                <MetaDot />
                <span>
                  <span className="font-bold text-slate-800">
                    {tournament.review_count}
                  </span>{" "}
                  verified{" "}
                  {tournament.review_count === 1 ? "review" : "reviews"}
                </span>
                <MetaDot />
                <button
                  type="button"
                  aria-expanded={breakdownOpen}
                  onClick={() => setBreakdownOpen((o) => !o)}
                  className={breakdownLinkClass(breakdownOpen)}
                >
                  Ratings breakdown
                  <Icon
                    name="chevron-down"
                    className={cn(
                      "h-3 w-3 transition-transform",
                      breakdownOpen && "rotate-180",
                    )}
                  />
                </button>
              </>
            ) : (
              <>
                <MetaDot />
                <span>No reviews yet</span>
              </>
            )}
            {eventCount > 0 && (
              <>
                <MetaDot />
                <button
                  type="button"
                  aria-expanded={showEvents}
                  onClick={() => setShowEvents((s) => !s)}
                  className={breakdownLinkClass(false)}
                >
                  {showEvents ? "Hide events" : "Show events"}
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <MetaDot />
                {ownerName ? (
                  <span className="text-slate-700">Owner: {ownerName}</span>
                ) : (
                  <span className="text-red-600">Unclaimed</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/dashboard/events/new?tournament=${tournament.id}` as Route}
          >
            <Button variant="outline" size="xs">
              <Icon name="plus" className="h-3 w-3" />
              Add event
            </Button>
          </Link>
          {canManage && (
            <Button variant="outline" size="xs" onClick={() => setEditing(true)}>
              <Icon name="edit" className="h-3 w-3" />
              Edit tournament
            </Button>
          )}
        </div>
      </div>

      {breakdownOpen && hasReviews && (
        <div className="px-5 pb-3.5">
          <RatingsBreakdown
            label={`${tournament.title} ratings breakdown`}
            overall={tournament.general_rating}
            coach={tournament.coach_rating}
            attendee={tournament.attendee_rating}
            reviewCount={tournament.review_count}
            showCoach={hasPremiumEvent}
            wouldReturnPct={aggregateWouldReturn(events)}
            categories={[
              { label: "Fields", value: tournament.avg_fields },
              { label: "Facilities", value: tournament.avg_facilities },
              { label: "Management", value: tournament.avg_management },
              { label: "Competition", value: tournament.avg_competition },
              { label: "Diversity", value: tournament.avg_diversity },
              { label: "Cost / value", value: tournament.avg_cost_value },
            ]}
            onClose={() => setBreakdownOpen(false)}
          />
        </div>
      )}

      {eventCount === 0 ? (
        <div className="px-5 pb-5">
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white px-5 py-6 text-center">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-red-600 shadow-sm">
              <Icon name="calendar" className="h-4 w-4" />
            </span>
            <p className="font-[var(--font-heading)] text-[14px] font-extrabold tracking-tight text-slate-900">
              No events yet
            </p>
            <p className="max-w-[46ch] text-[12px] font-medium leading-relaxed text-slate-500">
              Add the first event to publish this tournament — dates, venue and
              age groups — and start collecting verified reviews.
            </p>
            <Link
              href={
                `/dashboard/events/new?tournament=${tournament.id}` as Route
              }
              className="mt-1"
            >
              <Button size="sm">
                <Icon name="plus" className="h-3.5 w-3.5" />
                Add your first event
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        showEvents && (
          <>
            <div
              className={cn(
                EVENT_GRID_CLASS,
                "hidden border-t border-slate-200/80 bg-[#eef2f9] px-5 py-2 xl:grid",
              )}
            >
              <ColLabel>Event</ColLabel>
              <ColLabel>Status</ColLabel>
              <ColLabel>Dates</ColLabel>
              <ColLabel>Reviews &amp; rating</ColLabel>
              <p />
            </div>
            {visibleEvents.length === 0 ? (
              <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] font-medium text-slate-400">
                No events match this filter.
              </p>
            ) : (
              <EventList
                key={statusFilter}
                events={visibleEvents}
                seasons={seasons}
                canManage={(ev) => manageableEventIds.includes(ev.id)}
                isAdmin={isAdmin}
              />
            )}
          </>
        )
      )}

      {editing && (
        <EditTournamentDialog
          open={editing}
          onClose={() => setEditing(false)}
          canDelete={canManage}
          tournament={{
            id: tournament.id,
            title: tournament.title,
            recurring: tournament.recurring,
          }}
        />
      )}
    </section>
  );
}

function MetaDot() {
  return (
    <span aria-hidden className="text-slate-300">
      ·
    </span>
  );
}

function ColLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="whitespace-nowrap font-[var(--font-heading)] text-[10px] font-extrabold uppercase tracking-[0.11em] text-slate-500">
      {children}
    </p>
  );
}

/**
 * Tournament-level would-attend-again: the per-event percentages rolled
 * up, weighted by each event's review count (plain mean when no event
 * has reviews). An approximation — the schema keeps the true pool count
 * per event, not per tournament.
 */
function aggregateWouldReturn(events: EventListRow[]): number | null {
  const rated = events.filter((ev) => ev.would_return_pct != null);
  if (rated.length === 0) return null;
  const totalWeight = rated.reduce((sum, ev) => sum + ev.review_count, 0);
  if (totalWeight === 0) {
    return (
      rated.reduce((sum, ev) => sum + (ev.would_return_pct ?? 0), 0) /
      rated.length
    );
  }
  return (
    rated.reduce(
      (sum, ev) => sum + (ev.would_return_pct ?? 0) * ev.review_count,
      0,
    ) / totalWeight
  );
}
