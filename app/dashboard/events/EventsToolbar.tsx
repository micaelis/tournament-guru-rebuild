"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SearchInput, cn } from "@/app/components/ui";
import type { TournamentSort } from "./queries";
import {
  EVENT_STATUS_FILTERS,
  LIST_CARD_CLASS,
  type EventStatusFilter,
} from "./event-shared";

type Option = { value: TournamentSort; label: string };

const BASE_SORT_OPTIONS: Option[] = [
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "created_desc", label: "Creation date (newest)" },
  { value: "created_asc", label: "Creation date (oldest)" },
  { value: "rating_desc", label: "Average rating (high)" },
  { value: "rating_asc", label: "Average rating (low)" },
  { value: "reviews_desc", label: "Reviews (most)" },
  { value: "reviews_asc", label: "Reviews (fewest)" },
];

const ADMIN_EXTRA_SORT: Option[] = [
  { value: "owner_asc", label: "Owner (A–Z)" },
  { value: "owner_desc", label: "Owner (Z–A)" },
];

const STATUS_LABELS: Record<EventStatusFilter, string> = {
  all: "All",
  published: "Published",
  draft: "Drafts",
  concluded: "Concluded",
  canceled: "Canceled",
};

/**
 * The slim white toolbar card above the tournament list: pill search,
 * sort dropdown, (admin) CSV export, and the status tabs. Search, sort
 * and status update the URL so the server component re-fetches /
 * re-filters with the new params — no client-side filtering; RLS +
 * Postgres do the work.
 */
export function EventsToolbar({
  initialSearch,
  initialSort,
  activeStatus,
  isAdmin,
  hasResults,
}: {
  initialSearch: string;
  initialSort: TournamentSort;
  activeStatus: EventStatusFilter;
  isAdmin: boolean;
  hasResults: boolean;
}) {
  const sortOptions = isAdmin
    ? [...BASE_SORT_OPTIONS, ...ADMIN_EXTRA_SORT]
    : BASE_SORT_OPTIONS;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  function pushParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : ("?" as never));
    });
  }

  return (
    <div
      className={cn(
        LIST_CARD_CLASS,
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-3.5 py-2.5",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParam("q", search);
          }}
          onBlur={() => pushParam("q", search)}
          placeholder="Search your events…"
          aria-label="Search tournaments"
          className="w-full min-w-[220px] max-w-[300px] flex-1"
          inputClassName="rounded-full py-2 text-[13.5px]"
        />
        <select
          defaultValue={initialSort}
          onChange={(e) => pushParam("sort", e.target.value)}
          aria-label="Sort tournaments"
          className="tg-control tg-select w-auto min-w-[190px] flex-none rounded-full py-2 text-[13px]"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {isAdmin && (
          <a
            href={buildCsvHref(searchParams)}
            aria-disabled={!hasResults}
            className={
              hasResults
                ? "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-800 transition-colors hover:border-slate-400"
                : "pointer-events-none rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-[12.5px] font-bold text-slate-400"
            }
            title={
              hasResults
                ? "Download the current view as CSV"
                : "Nothing to export"
            }
            download
          >
            Export CSV
          </a>
        )}
      </div>

      <div
        role="group"
        aria-label="Filter events by status"
        className="inline-flex gap-0.5 rounded-full border-[1.5px] border-slate-300 p-[3px]"
      >
        {EVENT_STATUS_FILTERS.map((status) => {
          const active = status === activeStatus;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() =>
                pushParam("status", status === "all" ? null : status)
              }
              className={cn(
                "rounded-full border px-3 py-1 font-[var(--font-heading)] text-[12px] font-bold transition-colors",
                active
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-transparent text-slate-600 hover:text-slate-900",
              )}
            >
              {STATUS_LABELS[status]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildCsvHref(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString());
  const qs = params.toString();
  return `/dashboard/events/csv${qs ? `?${qs}` : ""}`;
}
