"use client";

import { useState } from "react";
import { EventRow } from "./EventRow";
import { Button } from "@/app/components/ui";
import type { EventListRow } from "./event-shared";

const PAGE_SIZE = 10;

/**
 * Paginated events list inside a tournament card. Spec: "If an events
 * list under a tournament is longer than 10 entries — show simple
 * functional pagination within this section."
 */
export function EventList({
  events,
  seasons,
  canManage,
}: {
  events: EventListRow[];
  seasons: Map<string, string>;
  canManage: (event: EventListRow) => boolean;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const slice = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {slice.map((ev) => (
        <EventRow
          key={ev.id}
          event={ev}
          seasonLabel={seasons.get(ev.season_id ?? "") ?? null}
          canManage={canManage(ev)}
        />
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-500">
          <span>
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, events.length)} of {events.length}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Prev
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
