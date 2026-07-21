"use client";

import { useState } from "react";
import type { FaqViewRow } from "./page";
import { EmptyState } from "@/app/components/ui";

export function FaqViewer({ rows }: { rows: FaqViewRow[] }) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const visible = q
    ? rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q),
      )
    : rows;

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search FAQ…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="tg-control max-w-sm"
      />
      {visible.length === 0 ? (
        <EmptyState
          compact
          title={q ? "No matching questions." : "No FAQs available yet."}
        />
      ) : (
        visible.map((r) => (
          <details
            key={r.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <summary className="cursor-pointer text-sm font-bold text-slate-900">
              {r.title}
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-700">
              {r.content}
            </p>
          </details>
        ))
      )}
    </div>
  );
}
