"use client";

import { useState } from "react";

/**
 * Keeps what the user typed when a form action round-trips a validation
 * error. React resets uncontrolled inputs once a form action settles, so we
 * snapshot the FormData at dispatch and feed it back through `defaultValue`
 * / `defaultChecked` — the reset then restores the submitted values instead
 * of blanks. Values never leave the browser; nothing is echoed by the server.
 *
 * Usage:
 *   const { values, capture } = useSubmittedValues();
 *   <form action={(fd) => { capture(fd); formAction(fd); }}>
 *     <input name="title" defaultValue={values.title ?? original} />
 */
export function useSubmittedValues(initial: Record<string, string> = {}) {
  const [snap, setSnap] = useState<{
    /** True once a submit has been captured — needed for checkboxes, where
     * "absent from values" means unchecked only after a submit happened. */
    submitted: boolean;
    values: Record<string, string>;
  }>({ submitted: false, values: initial });
  const capture = (formData: FormData) => {
    const next: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") next[key] = value;
    }
    setSnap({ submitted: true, values: next });
  };
  return { values: snap.values, submitted: snap.submitted, capture };
}
