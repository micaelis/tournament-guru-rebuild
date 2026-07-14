"use client";

import { useId, useState } from "react";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  marginBottom: 7,
};

const errorStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: "var(--color-accent)",
  marginTop: 6,
};

/** Label + control wrapper with accessible error wiring. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  optional,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
        {optional && (
          <span style={{ color: "var(--color-text-faint)", fontWeight: 500 }}>
            {" "}
            (optional)
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--color-text-muted)",
            marginTop: 6,
          }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  label,
  error,
  hint,
  optional,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} optional={optional}>
      <input
        id={inputId}
        className="tg-control"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
    </Field>
  );
}

export function PasswordInput({
  label,
  error,
  hint,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [show, setShow] = useState(false);
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint}>
      <div style={{ position: "relative" }}>
        <input
          id={inputId}
          type={show ? "text" : "password"}
          className="tg-control"
          aria-invalid={error ? true : undefined}
          style={{ paddingRight: 46 }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "var(--color-text-muted)",
            cursor: "pointer",
          }}
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </Field>
  );
}

export function Select({
  label,
  error,
  optional,
  id,
  placeholder,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  optional?: boolean;
  placeholder?: string;
}) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={selectId} error={error} optional={optional}>
      <select
        id={selectId}
        className="tg-control tg-select"
        aria-invalid={error ? true : undefined}
        defaultValue={props.defaultValue ?? ""}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
    </Field>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
