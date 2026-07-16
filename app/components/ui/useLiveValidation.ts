"use client";

import { useState } from "react";

type Validatable = { value: string; checkValidity(): boolean };

/**
 * Live-clears a server-reported field error once the user edits the field
 * into a valid state — and resurfaces it if they break it again. A fresh
 * server verdict always wins: whenever the `error` prop changes, the local
 * override resets and the new message shows.
 *
 * `validate` mirrors the server rule for the field (e.g. `validatePassword`
 * from lib/validation); without it we fall back to the control's native
 * constraint validation (required, type=email, pattern, …).
 */
export function useLiveValidation(
  error: string | undefined,
  validate?: (value: string) => string | null,
) {
  const [cleared, setCleared] = useState(false);
  // React 19 "reset state when a prop changes" idiom — setState during
  // render, no effect needed.
  const [lastError, setLastError] = useState(error);
  if (error !== lastError) {
    setLastError(error);
    setCleared(false);
  }
  const revalidate = (el: Validatable) => {
    if (!error) return;
    setCleared(validate ? validate(el.value) == null : el.checkValidity());
  };
  return { shownError: cleared ? undefined : error, revalidate };
}
