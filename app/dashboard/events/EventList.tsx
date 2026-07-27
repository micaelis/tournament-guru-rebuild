"use client";

import { useState } from "react";
import { EventRow } from "./EventRow";
import { Button, cn } from "@/app/components/ui";
import type { EventListRow } from "./event-shared";

const PAGE_SIZE = 10;

/**
 * Paginated events table inside a tournament card. Spec: "If an events
 * list under a tournament is longer than 10 entries — show simple
 * functional pagination within this section."
 */
export function EventList({
  events,
  seasons,
  canManage,
  isAdmin,
}: {
  events: EventListRow[];
  seasons: Map<string, string>;
  canManage: (event: EventListRow) => boolean;
  isAdmin?: boolean;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const slice = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <ul
        className={cn(
          // With no pagination footer the last row sits flush with the
          // card's rounded bottom — round its hover wash to match.
          totalPages === 1 &&
            "[&>li:last-child>div:first-child]:rounded-b-2xl",
        )}
      >
        {slice.map((ev) => (
          <EventRow
            key={ev.id}
            event={ev}
            seasonLabel={seasons.get(ev.season_id ?? "") ?? null}
            canManage={canManage(ev)}
            isAdmin={isAdmin}
          />
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[12px] font-medium text-slate-500">
          <span>
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, events.length)} of {events.length}
          </span>
          <div className="flex gap-1.5">
            <Button
              size="xs"
              variant="soft"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Prev
            </Button>
            <Button
              size="xs"
              variant="soft"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
