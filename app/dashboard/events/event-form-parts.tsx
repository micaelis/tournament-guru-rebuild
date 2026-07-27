"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/components/ui/cn";

export function CheckGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

/**
 * Multi-select pill group — one pill per option, click to toggle;
 * selected pills lead with a check glyph. Used for competition levels
 * and surfaces.
 */
export function MultiSelectPills<T extends string>({
  options,
  value,
  onChange,
  error,
}: {
  options: readonly { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active
                    ? value.filter((v) => v !== opt.value)
                    : [...value, opt.value],
                )
              }
              className={cn(
                // Checked = the app-wide soft red tint (S12.3) — solid
                // ink is reserved for primary CTAs.
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition hover:-translate-y-px",
                active
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900",
              )}
            >
              {active && <CheckGlyph />}
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}

/**
 * Numbered field wrapper — same layout as auth/parts Field but with
 * an optional inline icon container (used for URL fields, per spec:
 * "nice link icon container at the start of the input box").
 */
export function LabeledField({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <label htmlFor={htmlFor} id={id} className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-slate-800">
        {label}
        {required && <span aria-hidden="true" className="text-red-600">*</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

/** Input with a leading icon container — link glyph for website URL. */
export function IconInput({
  icon,
  ...rest
}: {
  icon: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-500">
        {icon}
      </span>
      <input {...rest} className="tg-control pl-12" />
    </div>
  );
}
