"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { Spinner } from "@/app/components/ui/Spinner";
import { TextLink } from "@/app/components/ui/TextLink";

/**
 * Small red-rule eyebrow sitting above each auth screen's heading
 * (e.g. "Sign in", "Create account"), mirroring the hero eyebrow on the
 * right panel so the two columns rhyme.
 */
export function AuthEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className="h-0.5 w-6 rounded-full"
        style={{ background: "var(--color-accent)" }}
      />
      <span className="font-[var(--font-heading)] text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
        {children}
      </span>
    </div>
  );
}

/**
 * Standard auth/onboarding form field. Wraps a labelled input with an
 * inline error message. Passed via the field name so useActionState's
 * fieldErrors map lights the right control. While an error is showing,
 * edits re-check the value (via `validate`, or native constraints) and
 * the message clears the moment the input becomes valid.
 */
export function Field({
  label,
  name,
  error,
  hint,
  validate,
  labelAccessory,
  children,
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  validate?: (value: string) => string | null;
  /** Renders on the label row's right edge (e.g. a status pill). */
  labelAccessory?: ReactNode;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const { shownError, revalidate } = useLiveValidation(error, validate);
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-slate-800">
          {label}
        </span>
        {labelAccessory}
      </span>
      {children ?? (
        <input
          {...rest}
          name={name}
          onInput={(e) => {
            rest.onInput?.(e);
            revalidate(e.currentTarget);
          }}
          aria-invalid={Boolean(shownError) || undefined}
          className="tg-control"
        />
      )}
      {hint && !shownError && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {shownError && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {shownError}
        </span>
      )}
    </label>
  );
}

/**
 * Password input with a show/hide eye toggle. `labelAccessory` renders on
 * the label row (used for the login "Forgot password?" link). The input is
 * controlled so the typed password survives React's post-action form reset
 * without ever being echoed back through the server. While an error is
 * showing, edits re-check the value (via `validate`, or native constraints)
 * and the message clears the moment the input becomes valid.
 */
export function PasswordField({
  label,
  name,
  error,
  hint,
  placeholder,
  autoComplete = "current-password",
  validate,
  labelAccessory,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  validate?: (value: string) => string | null;
  labelAccessory?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");
  const { shownError, revalidate } = useLiveValidation(error, validate);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={name} className="text-[13px] font-semibold text-slate-800">
          {label}
        </label>
        {labelAccessory}
      </div>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            revalidate(e.currentTarget);
          }}
          aria-invalid={Boolean(shownError) || undefined}
          className="tg-control"
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className={`absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-lg p-1.5 transition-colors hover:bg-slate-100 ${
            show ? "text-[var(--color-accent)]" : "text-slate-500"
          }`}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && !shownError && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {shownError && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {shownError}
        </span>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-8-10-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </svg>
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
      aria-busy={pending || undefined}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-bold text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-md disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
        className ?? ""
      }`}
      style={{
        background:
          "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
        boxShadow: "0 8px 20px -6px rgba(220,38,38,.5)",
      }}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

/**
 * Inline alert block for form-level errors + confirmation banners.
 * Success/info renders as a white surface card with a small green-check
 * disc — green lives only in the icon, so the note sits calmly on both
 * the gray dashboard bg and the white auth cards (S12.9).
 */
export function Alert({
  kind,
  children,
}: {
  kind: "error" | "info";
  children: ReactNode;
}) {
  if (kind === "error") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {children}
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,.04)]"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
      <div className="min-w-0 text-[13.5px] font-medium leading-relaxed text-slate-800">
        {children}
      </div>
    </div>
  );
}

/** Shows once when loginAction returns error === 'blocked'. */
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
          indefinitely blocked. If you believe this is a mistake, please
          reach out to our support team.
        </p>
        <TextLink
          href="mailto:support@tournamentguru.net"
          className="mt-3 block text-sm"
        >
          Contact support
        </TextLink>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
