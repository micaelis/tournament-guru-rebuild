"use client";

import { useFormStatus } from "react-dom";
import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Standard auth/onboarding form field. Wraps a labelled input with an
 * inline error message. Passed via the field name so useActionState's
 * fieldErrors map lights the right control.
 */
export function Field({
  label,
  name,
  error,
  hint,
  children,
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const invalid = Boolean(error);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
        {label}
      </span>
      {children ?? (
        <input
          {...rest}
          name={name}
          aria-invalid={invalid || undefined}
          className="tg-control"
        />
      )}
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

/**
 * Primary submit button that reads the pending state from useFormStatus
 * so it disables itself + shows a spinner while the server action runs.
 */
export function SubmitButton({
  children,
  className,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`tg-btn-primary tg-hover flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-60 ${
        className ?? ""
      }`}
    >
      {pending ? "…" : children}
    </button>
  );
}

/** Inline alert block for form-level errors + confirmation banners. */
export function Alert({
  kind,
  children,
}: {
  kind: "error" | "info";
  children: ReactNode;
}) {
  const isError = kind === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * The blocked-user modal. Shows once when loginAction returns
 * error === 'blocked'. The dismiss button routes back to /login.
 */
export function BlockedModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
    >
      <div className="max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          Account unavailable
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;re sorry to let you know that your account has been
          indefinitely blocked.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
