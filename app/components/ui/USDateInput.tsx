"use client";

/* Masked mm/dd/yyyy date input. Native `type="date"` renders its
   placeholder in the BROWSER's locale (a UK browser shows dd/mm/yyyy no
   matter what the page says), so US-facing date fields use this masked
   text input instead: the visible text is always mm/dd/yyyy while forms
   and callers receive ISO yyyy-mm-dd. */

import { useId, useState } from "react";
import { Field } from "./Field";
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
  ...props
}: BareProps) {
  const controlled = iso !== undefined;
  const [text, setText] = useState(usFromIso(controlled ? iso : defaultIso));

  // Controlled mode: adopt external ISO changes (presets, reset) without
  // clobbering in-progress typing, which also maps to "". React 19
  // adjust-state-during-render idiom — no effect, no extra paint.
  const [lastIso, setLastIso] = useState(iso);
  if (controlled && iso !== lastIso) {
    setLastIso(iso);
    if (isoFromUs(text) !== iso) setText(usFromIso(iso));
  }

  return (
    <>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        maxLength={10}
        value={text}
        onChange={(e) => {
          const masked = maskUsDate(e.target.value);
          setText(masked);
          onIsoChange?.(isoFromUs(masked));
        }}
      />
      {name && <input type="hidden" name={name} value={isoFromUs(text)} />}
    </>
  );
}

/**
 * Labelled form-field variant (ui/Field shell + live validation over the
 * ISO value) — the drop-in for auth/onboarding date-of-birth fields.
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
        className="tg-control"
        aria-invalid={shownError ? true : undefined}
        onIsoChange={(iso) =>
          revalidate({ value: iso, checkValidity: () => iso !== "" })
        }
      />
    </Field>
  );
}
