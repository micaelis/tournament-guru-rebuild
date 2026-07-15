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

const SORT_OPTIONS: Option[] = [
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "created_desc", label: "Creation date (newest)" },
  { value: "created_asc", label: "Creation date (oldest)" },
  { value: "rating_desc", label: "Average rating (high)" },
  { value: "rating_asc", label: "Average rating (low)" },
  { value: "reviews_desc", label: "Reviews (most)" },
  { value: "reviews_asc", label: "Reviews (fewest)" },
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
}: {
  initialSearch: string;
  initialSort: TournamentSort;
  showAdd: boolean;
}) {
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
            className="tg-control"
          />
        </div>
        <select
          defaultValue={initialSort}
          onChange={(e) => pushParam("sort", e.target.value)}
          className="tg-control tg-select w-auto min-w-[220px] flex-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
