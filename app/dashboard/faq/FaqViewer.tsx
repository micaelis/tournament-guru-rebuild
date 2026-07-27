"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FaqViewRow } from "./page";
import { FAQ_TOPICS } from "@/lib/faq/topics";
import {
  Button,
  Card,
  EmptyState,
  SearchInput,
  cn,
  textLinkClass,
} from "@/app/components/ui";
import { Icon } from "../icons";

/** Rows whose subject the mockup ships pre-expanded (the Guru-reviews
 * and claim explainers) — matched by title so admin edits degrade to
 * simply not pre-opening anything. */
const OPEN_BY_DEFAULT = /guru|claim/i;

export function FaqViewer({ rows }: { rows: FaqViewRow[] }) {
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const defaultOpenIds = useMemo(
    () =>
      new Set(rows.filter((r) => OPEN_BY_DEFAULT.test(r.title)).map((r) => r.id)),
    [rows],
  );
  const matchIds = useMemo(() => {
    if (!q) return null;
    return new Set(
      rows
        .filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.content.toLowerCase().includes(q),
        )
        .map((r) => r.id),
    );
  }, [rows, q]);

  const [openIds, setOpenIds] = useState<Set<string>>(defaultOpenIds);
  // Query transitions re-baseline the open set (matches auto-expand;
  // clearing restores the defaults) — the render-time adjustment
  // pattern, so user toggles still work within one query.
  const [prevQ, setPrevQ] = useState("");
  if (q !== prevQ) {
    setPrevQ(q);
    setOpenIds(matchIds ? new Set(matchIds) : defaultOpenIds);
  }

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function focusSearch() {
    searchWrapRef.current?.querySelector("input")?.focus();
  }
  function clearSearch() {
    setSearch("");
    focusSearch();
  }

  // "/" focuses the search from anywhere on the page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable))
        return;
      e.preventDefault();
      focusSearch();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const groups = FAQ_TOPICS.map((topic) => ({
    topic,
    rows: rows.filter((r) => r.topic === topic.id),
  })).filter((g) => g.rows.length > 0);

  const hits = matchIds ? matchIds.size : rows.length;

  return (
    <>
      {/* ── search + jump-to ── */}
      <Card className="mt-6 p-4 md:p-5">
        <div ref={searchWrapRef} className="relative">
          <SearchInput
            placeholder='Search the FAQ — try "review", "claim", "email"…'
            aria-label="Search FAQ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block"
            inputClassName="pr-16 text-[14.5px]"
          />
          {search !== "" && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-10 top-1/2 grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-[var(--font-heading)] text-[10.5px] font-extrabold text-slate-400 sm:block"
          >
            /
          </kbd>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2 px-0.5">
          <span className="mr-1 font-[var(--font-heading)] text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
            Jump to
          </span>
          {groups.map(({ topic, rows: topicRows }) => (
            <a
              key={topic.id}
              href={`#faq-topic-${topic.id}`}
              className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <Icon
                name={topic.icon}
                className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-red-700"
              />
              {topic.label}
              <span className="text-[10.5px] font-extrabold text-slate-400 transition-colors group-hover:text-red-400">
                {topicRows.length}
              </span>
            </a>
          ))}
        </div>
      </Card>

      {/* ── live search meta ── */}
      {matchIds && hits > 0 && (
        <p className="mt-4 text-[12.5px] font-medium text-slate-500">
          <span className="font-bold text-slate-800">{hits}</span>{" "}
          {hits === 1 ? "answer matches" : "answers match"} &ldquo;
          {search.trim()}&rdquo;
        </p>
      )}

      {/* ── zero results ── */}
      {matchIds && hits === 0 && (
        <EmptyState
          className="mt-6"
          icon={<Icon name="help" className="h-7 w-7" />}
          badgeIcon={<Icon name="search" className="h-3 w-3" />}
          title="No matching questions"
          body="Try a different word — or ask us directly and we'll point you the right way."
          action={
            <Button variant="secondary" onClick={clearSearch}>
              Clear search
            </Button>
          }
          secondary={
            <a href="#faq-support" className={cn(textLinkClass, "text-[12.5px]")}>
              Contact support
            </a>
          }
        />
      )}

      {/* ── topic sections ── */}
      {groups.map(({ topic, rows: topicRows }) => {
        const visibleRows = matchIds
          ? topicRows.filter((r) => matchIds.has(r.id))
          : topicRows;
        if (visibleRows.length === 0) return null;
        return (
          <section
            key={topic.id}
            id={`faq-topic-${topic.id}`}
            aria-labelledby={`faq-topic-${topic.id}-h`}
            className="mt-9"
          >
            <div className="flex items-center gap-3.5">
              <span
                className={cn(
                  "grid h-10 w-10 flex-none place-items-center rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1",
                  topic.accent
                    ? "bg-red-50 text-red-600 ring-red-100"
                    : "bg-white text-slate-600 ring-slate-200",
                )}
              >
                <Icon name={topic.icon} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h2
                  id={`faq-topic-${topic.id}-h`}
                  className="font-[var(--font-heading)] text-[16.5px] font-extrabold tracking-tight text-slate-900"
                >
                  {topic.label}
                </h2>
                <p className="text-[12px] font-medium text-slate-500">
                  {topic.blurb}
                </p>
              </div>
            </div>

            <Card className="mt-3.5 divide-y divide-slate-100 overflow-hidden">
              {visibleRows.map((r) => {
                const open = openIds.has(r.id);
                return (
                  <div key={r.id} className={cn(open && "bg-[#fafbfd]")}>
                    <h3 className="m-0">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggle(r.id)}
                        className="group flex w-full items-center gap-3.5 px-5 py-[17px] text-left transition-colors hover:bg-[#fafbfd] md:px-6"
                      >
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-[14.5px] leading-[1.45] transition-colors",
                            open
                              ? "font-bold text-slate-900"
                              : "font-semibold text-slate-800 group-hover:text-slate-900",
                          )}
                        >
                          {r.title}
                        </span>
                        <span
                          className={cn(
                            "grid h-7 w-7 flex-none place-items-center rounded-full border transition-all duration-200",
                            open
                              ? "rotate-180 border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-500",
                          )}
                        >
                          <Icon name="chevron-down" className="h-4 w-4" />
                        </span>
                      </button>
                    </h3>
                    {/* visibility rides the transition so the collapse
                        still animates, but a closed answer is truly
                        hidden (a11y + hit-testing, not just clipped) */}
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out",
                        open
                          ? "visible grid-rows-[1fr] opacity-100"
                          : "invisible grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-[620px] whitespace-pre-line px-5 pb-5 text-[13.5px] leading-[1.7] text-slate-600 md:px-6 md:pb-[22px]">
                          {r.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        );
      })}

      {rows.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={<Icon name="help" className="h-7 w-7" />}
          title="No FAQs available yet"
          body="Answers for your role will appear here as soon as they're published."
        />
      )}
    </>
  );
}
