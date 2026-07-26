"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/components/ui/cn";

/**
 * Multi-select pill group — one pill per option, click to toggle. Used
 * for competition levels, surfaces, and premium features.
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
              onClick={() =>
                onChange(
                  active
                    ? value.filter((v) => v !== opt.value)
                    : [...value, opt.value],
                )
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
              )}
            >
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
