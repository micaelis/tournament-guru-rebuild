"use client";

/*
 * EventSearchOverlay — the reusable "find an event" surface.
 *
 * One component, two jobs, driven by `mode`:
 *   • "review" → picking an event routes to /reviews/new?event=<id>
 *                (the Write-a-Review gate: choose the event before reviewing)
 *   • "browse" → picking an event routes to /events/<id>
 *
 * It is intentionally self-contained (input + live results + states) so the
 * hero search and the Find Events page can drop it in later without
 * re-implementing typeahead. Results come from /api/events/search.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventSearchRow } from "@/lib/supabase/queries";

type Mode = "review" | "browse";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ageGenderLabel(e: EventSearchRow): string | null {
  const ages = e.event_ages?.map((a) => a.age.toUpperCase()).sort() ?? [];
  const age =
    ages.length > 1 ? `${ages[0]}–${ages[ages.length - 1]}` : ages[0];
  const gender =
    e.event_genders
      ?.map((g) => capitalize(g.gender))
      .find((g) => g !== "Both") ?? null;
  if (!age && !gender) return null;
  return [age, gender].filter(Boolean).join(" ");
}

function stripCountry(loc: string): string {
  return loc.replace(/,\s*USA$/i, "").replace(/,\s*United States$/i, "");
}

function fmtRange(start?: string | null, end?: string | null): string {
  if (!start) return "Dates TBA";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (!end || end === start) return s.toLocaleDateString("en-US", opts);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startStr = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${startStr} – ${e.toLocaleDateString("en-US", opts)}`;
}

/* Status chip mirroring the FeaturedShowcase "Open" pill treatment. An event
   whose end date has passed reads as Concluded even if its raw status still
   says "open" — so a finished event never shows a misleading green "Open". */
function StatusChip({
  status,
  endDate,
}: {
  status: string | null;
  endDate: string | null;
}) {
  let s = (status ?? "").toLowerCase();
  if (s !== "canceled" && s !== "concluded" && endDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (endDate < today) s = "concluded";
  }
  const map: Record<
    string,
    { label: string; color: string; bg: string; border: string; dot: string }
  > = {
    open: {
      label: "Open",
      color: "#15803d",
      bg: "#ecfdf5",
      border: "#bbf7d0",
      dot: "#16a34a",
    },
    concluded: {
      label: "Concluded",
      color: "#475569",
      bg: "#f1f5f9",
      border: "#e2e8f0",
      dot: "#94a3b8",
    },
    canceled: {
      label: "Canceled",
      color: "#b91c1c",
      bg: "#fef2f2",
      border: "#fecaca",
      dot: "#dc2626",
    },
  };
  const c = map[s];
  if (!c) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
        padding: "3px 9px 3px 7px",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span
        className="rounded-full"
        style={{ width: 5, height: 5, background: c.dot }}
      />
      {c.label}
    </span>
  );
}

function LogoThumb({ logo, title }: { logo: string | null; title: string }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl"
      style={{
        width: 56,
        height: 56,
        background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)",
        border: "1px solid var(--color-border)",
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`${title} logo`}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            maxWidth: "80%",
            maxHeight: "80%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
      ) : (
        <span
          className="font-heading absolute inset-0 flex items-center justify-center font-extrabold"
          style={{
            fontSize: 18,
            background:
              "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          TG
        </span>
      )}
    </div>
  );
}

export function EventSearchOverlay({
  open,
  onClose,
  mode = "browse",
  title,
  subtitle,
  initialQuery = "",
}: {
  open: boolean;
  onClose: () => void;
  mode?: Mode;
  title?: string;
  subtitle?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<EventSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // React 19 "reset on external change" idiom. When the overlay
  // transitions from closed → open, reseed the query with any
  // caller-supplied `initialQuery` and clear active selection. Doing
  // this during render (guarded by a same-turn detection state) rather
  // than in a useEffect(setState, [open]) satisfies react-hooks/set-
  // state-in-effect without adding an extra render pass.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery(initialQuery);
      setActive(-1);
    }
  }

  const heading =
    title ?? (mode === "review" ? "Which event are you reviewing?" : "Search events");
  const sub =
    subtitle ??
    (mode === "review"
      ? "Find the tournament you attended, then continue to your review."
      : "Find a tournament by name, city, or state.");

  const select = useCallback(
    (e: EventSearchRow) => {
      onClose();
      // Both discovery and review flows land on the event page — the review
      // form itself lives there, so the search picker just needs to hand
      // off which event they want to talk about.
      router.push(`/events/${e.id}`);
    },
    [onClose, router]
  );

  // Fetch results (debounced) whenever the query changes while open.
  // Loading + error resets happen inside the debounce timer callback so
  // they don't fire synchronously in the effect body (react-hooks/set-
  // state-in-effect). Downside: the loading skeleton doesn't paint
  // during the 220ms debounce quiet window — for typeahead that's fine.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/events/search?q=${encodeURIComponent(query.trim())}${
            mode === "review" ? "&concluded=1" : ""
          }`
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Search failed");
          setResults([]);
        } else {
          setResults(json.events ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Search failed");
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, mode]);

  // Focus the input once when opening (state reset happens during
  // render above).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keyboard: Escape closes; arrows move; Enter selects.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" && active >= 0 && results[active]) {
        e.preventDefault();
        select(results[active]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, onClose, select]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-center overflow-y-auto"
      style={{ background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <div
        className="relative mx-4 mt-[7vh] mb-16 flex w-full max-w-[680px] flex-col overflow-hidden rounded-3xl bg-white"
        style={{
          boxShadow:
            "0 30px 80px -20px rgba(15,23,42,.5), 0 0 0 1px rgba(15,23,42,.04)",
          maxHeight: "82vh",
        }}
      >
        {/* Header + search input */}
        <div
          className="shrink-0"
          style={{
            padding: "20px 22px 16px",
            borderBottom: "1px solid var(--color-border-light)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="font-heading text-dark"
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {heading}
              </h2>
              <p
                className="mt-1 mb-0"
                style={{ fontSize: 13, color: "var(--color-text-muted)" }}
              >
                {sub}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors hover:bg-[var(--color-border-light)]"
              style={{ width: 32, height: 32, borderColor: "var(--color-border)" }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            className="group/search mt-4 flex items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[#f8fafc] transition-all duration-200 hover:border-[var(--color-text-faint)] hover:shadow-[0_2px_8px_rgba(15,23,42,.08)] focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_rgba(220,38,38,.1)]"
          >
            <svg
              className="ml-4 shrink-0 text-[#94a3b8] transition-all duration-200 group-hover/search:translate-x-0.5 group-hover/search:scale-110 group-focus-within/search:translate-x-0.5 group-focus-within/search:text-[var(--color-accent)]"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(-1);
              }}
              placeholder="Search by keyword"
              className="w-full bg-transparent py-3 pr-3 pl-3 text-[15px] text-dark placeholder-gray-400"
              style={{ outline: "none" }}
              aria-label="Search events"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="mr-2 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white"
                style={{ width: 28, height: 28, color: "#94a3b8" }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ padding: "10px 12px 14px" }}
        >
          {loading && results.length === 0 ? (
            <SkeletonRows />
          ) : error ? (
            <StateMessage
              icon="!"
              title="Couldn’t search right now"
              detail={error}
            />
          ) : results.length === 0 ? (
            <StateMessage
              icon="🔍"
              title={
                query.trim()
                  ? mode === "review"
                    ? "No concluded events found"
                    : "No events found"
                  : "Start typing to search"
              }
              detail={
                query.trim()
                  ? mode === "review"
                    ? "You can only review events that have already finished. Try another name, city, or state."
                    : "Try a different name, city, or state."
                  : mode === "review"
                    ? "Find a tournament you attended — only finished events can be reviewed."
                    : "Search by event name, host club, city, or state."
              }
            />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {results.map((e, i) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => select(e)}
                    className="group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border text-left transition-colors"
                    style={{
                      padding: "10px 12px",
                      borderColor:
                        active === i ? "rgba(220,38,38,.35)" : "transparent",
                      background: active === i ? "#fef2f2" : "transparent",
                    }}
                  >
                    <LogoThumb logo={e.logo} title={e.title} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span
                          className="font-heading truncate text-dark"
                          style={{
                            fontSize: 15.5,
                            fontWeight: 700,
                            letterSpacing: "-0.015em",
                          }}
                        >
                          {e.title}
                        </span>
                        <StatusChip status={e.status} endDate={e.end_date} />
                      </span>
                      <span
                        className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1"
                        style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                      >
                        {(e.location_text || e.state) && (
                          <span className="inline-flex items-center gap-1">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z" />
                              <circle cx="12" cy="9" r="2.5" />
                            </svg>
                            {stripCountry(e.location_text || e.state || "")}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <rect x="3" y="5" width="18" height="16" rx="2" />
                            <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
                          </svg>
                          {fmtRange(e.start_date, e.end_date)}
                        </span>
                        {ageGenderLabel(e) && (
                          <span className="inline-flex items-center gap-1">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <circle cx="9" cy="8" r="3" />
                              <path d="M2 21c0-3 3-5 7-5s7 2 7 5M17 11l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {ageGenderLabel(e)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className="font-heading shrink-0 rounded-full px-4 py-1.5 text-white transition-transform group-hover:-translate-y-0.5"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        background:
                          mode === "review"
                            ? "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)"
                            : "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
                        boxShadow:
                          mode === "review"
                            ? "0 6px 16px -6px rgba(220,38,38,.5)"
                            : "0 6px 16px -6px rgba(15,23,42,.4)",
                      }}
                    >
                      {mode === "review" ? "Review" : "Open"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StateMessage({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail: string;
}) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ padding: "42px 24px" }}
    >
      <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden="true">
        {icon}
      </div>
      <div className="text-dark" style={{ fontSize: 15, fontWeight: 700 }}>
        {title}
      </div>
      <div className="mt-1" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
        {detail}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul className="m-0 flex animate-pulse list-none flex-col gap-1.5 p-0">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3.5" style={{ padding: "10px 12px" }}>
          <div className="h-14 w-14 shrink-0 rounded-xl bg-gray-200" />
          <div className="flex-1">
            <div className="h-4 w-2/5 rounded bg-gray-200" />
            <div className="mt-2 h-3 w-3/5 rounded bg-gray-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
