"use client";

/* Masked mm/dd/yyyy date input. Native `type="date"` renders its
   placeholder in the BROWSER's locale (a UK browser shows dd/mm/yyyy no
   matter what the page says), so US-facing date fields use this masked
   text input instead: the visible text is always mm/dd/yyyy while forms
   and callers receive ISO yyyy-mm-dd. */

import { useEffect, useId, useRef, useState } from "react";
import { Field } from "./Field";
import { cn } from "./cn";
import { useLiveValidation } from "./useLiveValidation";

/** Progressive mask: keep digits, insert slashes after MM and DD. */
export function maskUsDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Complete, real mm/dd/yyyy → ISO yyyy-mm-dd; anything else → "". */
export function isoFromUs(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return "";
  const [, mm, dd, yyyy] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const real =
    date.getFullYear() === Number(yyyy) &&
    date.getMonth() === Number(mm) - 1 &&
    date.getDate() === Number(dd);
  return real ? `${yyyy}-${mm}-${dd}` : "";
}

/** ISO yyyy-mm-dd → mm/dd/yyyy (returns "" for non-ISO input). */
export function usFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
}

/** Local-time ISO stamp — never toISOString (that shifts through UTC). */
export function isoOfDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type CalendarCell = { iso: string; day: number; inMonth: boolean };

/**
 * The day grid for one month: whole weeks (Sunday-first, US), padded
 * with the neighbors' trailing/leading days — exactly the weeks the
 * month touches, 4–6 rows, always a multiple of 7 cells.
 */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const lead = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const count = Math.ceil((lead + daysInMonth) / 7) * 7;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(year, month, 1 - lead + i);
    cells.push({
      iso: isoOfDate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  return cells;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * The in-house calendar popover behind USDateText's `calendar` prop.
 * A picker on top of — never instead of — the masked text input, so it
 * must not reintroduce the native browser date picker (locale-dependent
 * placeholder, CLAUDE.md "Dates"). Selected day wears the S12.3 red
 * tint; month/year selects keep DOB-range navigation cheap.
 */
function CalendarPopover({
  iso,
  onPick,
  onClose,
}: {
  iso: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const today = isoOfDate(new Date());
  const seed = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  const [view, setView] = useState(() =>
    seed
      ? { y: Number(seed[1]), m: Number(seed[2]) - 1 }
      : { y: new Date().getFullYear(), m: new Date().getMonth() },
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!ref.current?.parentElement?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const yearNow = new Date().getFullYear();
  const years: number[] = [];
  for (let y = yearNow + 10; y >= 1920; y--) years.push(y);

  const shift = (delta: number) => {
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Choose date"
      className="absolute left-0 top-full z-30 mt-2 w-[19rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        >
          ‹
        </button>
        <select
          aria-label="Month"
          value={view.m}
          onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-800"
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={view.y}
          onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-800"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shift(1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        >
          ›
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"
          >
            {d}
          </span>
        ))}
        {monthGrid(view.y, view.m).map((cell) => {
          const selected = cell.iso === iso;
          const isToday = cell.iso === today;
          return (
            <button
              key={cell.iso}
              type="button"
              aria-label={usFromIso(cell.iso)}
              aria-pressed={selected}
              onClick={() => onPick(cell.iso)}
              className={cn(
                "mx-auto grid h-8 w-8 place-items-center rounded-lg border text-[12.5px] font-semibold transition-colors",
                selected
                  ? "border-red-600 bg-red-50 text-red-700"
                  : cn(
                      "border-transparent hover:bg-slate-100",
                      cell.inMonth ? "text-slate-700" : "text-slate-300",
                      isToday && "border-slate-300",
                    ),
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type BareProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  /** Form mode: hidden input under this name posts the ISO value. */
  name?: string;
  /** Form mode: initial ISO value. */
  defaultIso?: string;
  /** Controlled mode: current ISO value ("" = empty/incomplete). */
  iso?: string;
  /** Fires with ISO when the text becomes a complete date, "" otherwise. */
  onIsoChange?: (iso: string) => void;
  /**
   * Adds the calendar-popover picker beside the mask. Opt-in because it
   * needs room for the toggle glyph and a downward popover — bare
   * embeds with their own shells (filter drawer) stay typing-only.
   */
  calendar?: boolean;
};

/**
 * Bare masked input (no label shell) — style it via className like any
 * <input>. Use `USDateField` for the labelled form-field variant.
 */
export function USDateText({
  name,
  defaultIso = "",
  iso,
  onIsoChange,
  placeholder = "mm/dd/yyyy",
  calendar = false,
  className,
  ...props
}: BareProps) {
  const controlled = iso !== undefined;
  const [text, setText] = useState(usFromIso(controlled ? iso : defaultIso));
  const [open, setOpen] = useState(false);

  // Controlled mode: adopt external ISO changes (presets, reset) without
  // clobbering in-progress typing, which also maps to "". React 19
  // adjust-state-during-render idiom — no effect, no extra paint.
  const [lastIso, setLastIso] = useState(iso);
  if (controlled && iso !== lastIso) {
    setLastIso(iso);
    if (isoFromUs(text) !== iso) setText(usFromIso(iso));
  }

  const input = (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      maxLength={10}
      value={text}
      className={calendar ? cn(className, "pr-10") : className}
      onChange={(e) => {
        const masked = maskUsDate(e.target.value);
        setText(masked);
        onIsoChange?.(isoFromUs(masked));
      }}
    />
  );
  const hidden = name && (
    <input type="hidden" name={name} value={isoFromUs(text)} />
  );

  if (!calendar) {
    return (
      <>
        {input}
        {hidden}
      </>
    );
  }

  return (
    <div className="relative">
      {input}
      <button
        type="button"
        aria-label="Open calendar"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <CalendarGlyph />
      </button>
      {open && (
        <CalendarPopover
          iso={isoFromUs(text)}
          onPick={(picked) => {
            setText(usFromIso(picked));
            onIsoChange?.(picked);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
      {hidden}
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/**
 * Labelled form-field variant (ui/Field shell + live validation over the
 * ISO value) — the drop-in for auth/onboarding date-of-birth fields.
 * Ships the calendar picker by default (the Field shell always has the
 * room for it); typing stays first-class.
 */
export function USDateField({
  label,
  name,
  defaultIso,
  hint,
  error,
  required,
  validate,
}: {
  label: string;
  name: string;
  defaultIso?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Runs against the ISO value ("" while incomplete). */
  validate?: (iso: string) => string | null;
}) {
  const inputId = useId();
  const { shownError, revalidate } = useLiveValidation(error, validate);
  return (
    <Field label={label} htmlFor={inputId} error={shownError} hint={hint}>
      <USDateText
        id={inputId}
        name={name}
        defaultIso={defaultIso}
        required={required}
        calendar
        className="tg-control"
        aria-invalid={shownError ? true : undefined}
        onIsoChange={(iso) =>
          revalidate({ value: iso, checkValidity: () => iso !== "" })
        }
      />
    </Field>
  );
}
