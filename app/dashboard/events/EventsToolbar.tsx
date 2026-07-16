"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/app/components/ui";
import {
  CreateTournamentDialog,
  AddFirstEventPrompt,
} from "./TournamentDialogs";
import type { TournamentSort } from "./queries";

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

/**
 * The row above the tournament list: search box, sort dropdown, and
 * the "Add New Tournament" CTA. Search + sort update the URL so the
 * server component re-fetches with the new params (no client-side
 * filtering — RLS + Postgres do the work).
 */
export function EventsToolbar({
  initialSearch,
  initialSort,
  showAdd,
  isAdmin,
  hasResults,
}: {
  initialSearch: string;
  initialSort: TournamentSort;
  showAdd: boolean;
  isAdmin: boolean;
  hasResults: boolean;
}) {
  const sortOptions = isAdmin
    ? [...BASE_SORT_OPTIONS, ...ADMIN_EXTRA_SORT]
    : BASE_SORT_OPTIONS;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);

  function pushParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : "?" as never);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushParam("q", search);
            }}
            onBlur={() => pushParam("q", search)}
            placeholder="Search tournaments…"
            aria-label="Search tournaments"
            className="tg-control"
          />
        </div>
        <select
          defaultValue={initialSort}
          onChange={(e) => pushParam("sort", e.target.value)}
          aria-label="Sort tournaments"
          className="tg-control tg-select w-auto min-w-[220px] flex-none"
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
                ? "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:border-slate-400"
                : "pointer-events-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-400"
            }
            title={hasResults ? "Download the current view as CSV" : "Nothing to export"}
            download
          >
            Export CSV
          </a>
        )}
        {showAdd && (
          <Button onClick={() => setCreating(true)} disabled={pending}>
            + New tournament
          </Button>
        )}
      </div>

      <CreateTournamentDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setCreatedId(id);
          startTransition(() => router.refresh());
        }}
      />
      {createdId && (
        <AddFirstEventPrompt
          tournamentId={createdId}
          onDismiss={() => setCreatedId(null)}
        />
      )}
    </>
  );
}

function buildCsvHref(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString());
  const qs = params.toString();
  return `/dashboard/events/csv${qs ? `?${qs}` : ""}`;
}
