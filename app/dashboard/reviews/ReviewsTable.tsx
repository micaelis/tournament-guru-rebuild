"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  ConfirmDialog,
  StarRating,
  StatusPill,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@/app/components/ui";
import { roleDisplayLabel, REVIEW_CATEGORIES, formatRating } from "@/lib/reviews/shared";
import type { ReviewCardRow } from "@/lib/reviews/queries";
import { deleteReview } from "@/lib/reviews/actions";
import { OwnerReplyDialog } from "./OwnerReplyDialog";
import { AdminEditDialog } from "./AdminEditDialog";

type Row = ReviewCardRow & {
  event: { id: string; title: string; location_state_abbr: string | null } | null;
};

type SortKey =
  | "created_desc"
  | "created_asc"
  | "overall_desc"
  | "overall_asc"
  | "fields_desc"
  | "facilities_desc"
  | "management_desc"
  | "competition_desc"
  | "diversity_desc"
  | "cost_desc";

const PAGE_SIZE = 30;

/**
 * Dashboard reviews table for ED + Admin. Live filters (search by
 * user name, review type, state), sort dropdown, pagination, bulk
 * export. Owner-reply modal (ED) + admin edit/delete inline.
 */
export function ReviewsTable({
  rows,
  currentUserId,
  isAdmin,
  availableStates,
  initialSearch,
  initialPromoFilter,
  initialStateFilter,
}: {
  rows: Row[];
  currentUserId: string;
  isAdmin: boolean;
  availableStates: string[];
  initialSearch: string;
  initialPromoFilter: string;
  initialStateFilter: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [promoFilter, setPromoFilter] = useState(initialPromoFilter);
  const [stateFilter, setStateFilter] = useState(initialStateFilter);
  const [sort, setSort] = useState<SortKey>("created_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [replyingFor, setReplyingFor] = useState<Row | null>(null);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { push } = useToast();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const name = [r.author?.first_name, r.author?.last_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (promoFilter === "with" && !r.promo_pretty_code) return false;
      if (promoFilter === "without" && r.promo_pretty_code) return false;
      if (stateFilter && r.event?.location_state_abbr !== stateFilter) {
        return false;
      }
      return true;
    });
  }, [rows, search, promoFilter, stateFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "created_desc":
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "created_asc":
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "overall_desc":
        list.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
        break;
      case "overall_asc":
        list.sort((a, b) => (a.overall ?? 0) - (b.overall ?? 0));
        break;
      case "fields_desc":
        list.sort((a, b) => (b.rating_fields ?? 0) - (a.rating_fields ?? 0));
        break;
      case "facilities_desc":
        list.sort(
          (a, b) => (b.rating_facilities ?? 0) - (a.rating_facilities ?? 0),
        );
        break;
      case "management_desc":
        list.sort(
          (a, b) => (b.rating_management ?? 0) - (a.rating_management ?? 0),
        );
        break;
      case "competition_desc":
        list.sort(
          (a, b) => (b.rating_competition ?? 0) - (a.rating_competition ?? 0),
        );
        break;
      case "diversity_desc":
        list.sort(
          (a, b) => (b.rating_diversity ?? 0) - (a.rating_diversity ?? 0),
        );
        break;
      case "cost_desc":
        list.sort(
          (a, b) => (b.rating_cost_value ?? 0) - (a.rating_cost_value ?? 0),
        );
        break;
    }
    return list;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const shown = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const shownIds = new Set(shown.map((r) => r.id));
  const allSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));

  const clearFilters = () => {
    setSearch("");
    setPromoFilter("");
    setStateFilter("");
    setSort("created_desc");
  };

  const exportCsv = () => {
    if (selected.size === 0) return;
    const chosen = sorted.filter((r) => selected.has(r.id));
    const csv = buildCsv(chosen, isAdmin);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "tournament-guru-reviews.csv";
    a.click();
    URL.revokeObjectURL(href);
    push("success", `Downloaded ${chosen.length} review(s).`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search by user name…"
          className="tg-control min-w-[240px] flex-1"
        />
        <select
          value={promoFilter}
          onChange={(e) => {
            setPromoFilter(e.target.value);
            setPage(0);
          }}
          className="tg-control tg-select w-auto min-w-[200px]"
        >
          <option value="">Any review type</option>
          <option value="with">With Promo Code</option>
          <option value="without">Without Promo Code</option>
        </select>
        {availableStates.length > 0 && (
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setPage(0);
            }}
            className="tg-control tg-select w-auto min-w-[160px]"
          >
            <option value="">Any state</option>
            {availableStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="tg-control tg-select w-auto min-w-[200px]"
        >
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="overall_desc">Overall (high)</option>
          <option value="overall_asc">Overall (low)</option>
          <option value="fields_desc">Fields (high)</option>
          <option value="facilities_desc">Facilities (high)</option>
          <option value="management_desc">Management (high)</option>
          <option value="competition_desc">Competition (high)</option>
          <option value="diversity_desc">Diversity (high)</option>
          <option value="cost_desc">Cost / value (high)</option>
        </select>
        {(search || promoFilter || stateFilter || sort !== "created_desc") && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        {selected.size > 0 && (
          <Button variant="primary" size="sm" onClick={exportCsv}>
            Export {selected.size} reviews
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No reviews match your filters.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allSelected}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const id of shownIds) {
                        if (e.target.checked) next.add(id);
                        else next.delete(id);
                      }
                      return next;
                    });
                  }}
                />
              </TH>
              <TH>Reviewer</TH>
              <TH>Event</TH>
              <TH>Overall</TH>
              <TH>Categories</TH>
              <TH>Date</TH>
              <TH className="w-40">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {shown.map((r) => (
              <ReviewRow
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                onToggleSelect={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    return next;
                  })
                }
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onReply={() => setReplyingFor(r)}
                onEdit={() => setEditingRow(r)}
                onDelete={() => setDeletingId(r.id)}
              />
            ))}
          </tbody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-2 text-xs text-slate-500">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {replyingFor && (
        <OwnerReplyDialog
          review={replyingFor}
          onClose={() => setReplyingFor(null)}
        />
      )}
      {editingRow && (
        <AdminEditDialog
          review={editingRow}
          onClose={() => setEditingRow(null)}
        />
      )}
      <ConfirmDialog
        open={deletingId !== null}
        title="Delete this review?"
        body="This will also remove its comments + flag records. The platform-wide review counter is preserved."
        confirmLabel="Delete review"
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          const res = await deleteReview(deletingId);
          setDeletingId(null);
          if (res.error) return push("error", res.error);
          push("success", "Review deleted.");
        }}
      />
    </div>
  );
}

function ReviewRow({
  row,
  selected,
  onToggleSelect,
  currentUserId,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
}: {
  row: Row;
  selected: boolean;
  onToggleSelect: () => void;
  currentUserId: string;
  isAdmin: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = row.anonymized
    ? "Former member"
    : [row.author?.first_name, row.author?.last_name]
        .filter(Boolean)
        .join(" ") || "Reviewer";
  const roleLabel = roleDisplayLabel(row.reviewer_role, row.guru_review);
  const canDelete = isAdmin || row.author_id === currentUserId;
  return (
    <TR>
      <TD>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select review ${row.id}`}
        />
      </TD>
      <TD>
        <div className="flex items-center gap-2">
          <Avatar
            src={row.author?.profile_photo_url}
            name={name}
            size={32}
          />
          <div>
            <p className="text-sm font-bold text-slate-900">{name}</p>
            <p className="text-[11px] text-slate-500">
              {roleLabel}
              {row.promo_pretty_code ? ` · ${row.promo_pretty_code}` : ""}
            </p>
          </div>
        </div>
      </TD>
      <TD>
        {row.event ? (
          <Link
            href={`/events/${row.event.id}` as Route}
            className="font-semibold text-slate-900 hover:text-red-600"
          >
            {row.event.title}
          </Link>
        ) : row.detached ? (
          <span className="text-slate-500">
            {row.snapshot_event_title ?? "Deleted event"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
        <div className="mt-1 flex items-center gap-2">
          <StatusPill tone={row.status === "published" ? "success" : "draft"}>
            {row.status === "published" ? "Published" : "Draft"}
          </StatusPill>
        </div>
      </TD>
      <TD>
        <StarRating value={row.overall ?? 0} size={12} />
      </TD>
      <TD>
        <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          {REVIEW_CATEGORIES.map((c) => (
            <span key={c.key} className="flex items-center gap-1">
              <span className="text-slate-400">{c.label.split(" ")[0]}</span>
              <span className="font-bold text-slate-800">
                {formatRating(row[c.key] as number | null)}
              </span>
            </span>
          ))}
        </div>
      </TD>
      <TD className="text-xs text-slate-500">
        {formatDate(row.created_at)}
      </TD>
      <TD>
        <div className="flex flex-wrap items-center gap-1">
          {!isAdmin && (
            <Button size="sm" variant="ghost" onClick={onReply}>
              Reply
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </TD>
    </TR>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildCsv(rows: Row[], includeEmail: boolean): string {
  const header = [
    "Reviewer",
    ...(includeEmail ? ["Email"] : []),
    "Organization",
    "Role",
    "Event",
    "Review Title",
    "Review Body",
    "Has Promo",
    "Overall",
    "Fields",
    "Facilities",
    "Management",
    "Competition",
    "Diversity",
    "Cost/Value",
    "Created",
  ];
  const lines = rows.map((r) => {
    const name =
      [r.author?.first_name, r.author?.last_name].filter(Boolean).join(" ") ||
      "Reviewer";
    const cells: (string | number)[] = [
      name,
      // Email is intentionally blank in the CSV — the dashboard row doesn't
      // fetch auth.users.email; a real "include email" export would run a
      // service-role query. Keeping the column so the header shape stays
      // stable when we wire that in.
      ...(includeEmail ? [""] : []),
      r.author?.organization_title ?? "",
      r.reviewer_role ?? "",
      r.event?.title ?? r.snapshot_event_title ?? "",
      r.review_title ?? "",
      (r.review_body ?? "").replace(/\r?\n/g, " "),
      r.promo_pretty_code ? "Yes" : "No",
      r.overall !== null ? r.overall.toFixed(2) : "",
      r.rating_fields ?? "",
      r.rating_facilities ?? "",
      r.rating_management ?? "",
      r.rating_competition ?? "",
      r.rating_diversity ?? "",
      r.rating_cost_value ?? "",
      r.created_at,
    ];
    return cells
      .map((c) => {
        const s = String(c ?? "");
        const needsQuote = /[",\n]/.test(s);
        const escaped = s.replace(/"/g, '""');
        return needsQuote ? `"${escaped}"` : escaped;
      })
      .join(",");
  });
  return [header.join(","), ...lines].join("\n");
}
