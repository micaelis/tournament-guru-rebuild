"use client";

import { cn } from "./cn";

/**
 * Binary on/off toggle for settings matrices (notification channels).
 * Deliberately BUTTON-backed (`role="switch"` + `aria-checked`), not a
 * checkbox: after a Server Action completes, React's automatic form
 * reset snaps checkbox DOM state back to its initial `checked`
 * attribute, and a controlled input whose React state didn't change
 * never gets re-written — so a just-saved "off" rendered as "on"
 * (S12.10). Buttons and hidden inputs are immune to form resets, so
 * the visible state and the submitted value both stay truthful.
 *
 * Controlled only. When `name` is set and the switch is on, it submits
 * `<name>=on` via a hidden input — the same wire format as Checkbox —
 * and submits nothing when off. Checked = ink track (the Checkbox fill
 * rule); never red — the accent marks *choices*, not on/off (S12.3).
 */
export function Switch({
  name,
  checked,
  onChange,
  "aria-label": ariaLabel,
  disabled,
  className,
}: {
  /** Form field name; submitted as `name=on` only while checked. */
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The switch renders no visible label of its own — name it for AT. */
  "aria-label": string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 flex-none rounded-full transition-colors duration-150",
          checked
            ? "bg-slate-900 hover:bg-slate-700"
            : "bg-slate-200 hover:bg-slate-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-1",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,.3)] transition-transform duration-150",
            checked && "translate-x-4",
          )}
        />
      </button>
      {name && checked && <input type="hidden" name={name} value="on" />}
    </span>
  );
}
