"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = {
  variant?: "primary" | "ghost" | "danger" | "link";
  size?: "sm" | "md" | "lg";
  /** Optional label swap while pending (e.g. "Saving…"); the spinner
   * shows either way. */
  pendingLabel?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/**
 * Whether this button owns the form's in-flight submission. A button
 * with no submitter identity (no name/value) owns every submission —
 * the single-submit case. With an identity, it owns the submission only
 * when the in-flight FormData carries its own name/value pair (the
 * browser includes exactly the clicked submitter's pair), so sibling
 * submit buttons don't all light up.
 */
export function ownsPending(
  pending: boolean,
  data: FormData | null,
  name: string | undefined,
  value: ButtonHTMLAttributes<HTMLButtonElement>["value"],
): boolean {
  if (!pending) return false;
  if (name === undefined || value === undefined) return true;
  return data?.get(name) === String(value);
}

/**
 * A submit Button that reads the enclosing form action's pending state
 * and shows the shared spinner (plus an optional label swap) while it
 * runs. Drop-in replacement for `<Button type="submit">` in forms
 * driven by useActionState.
 *
 * Forms with MULTIPLE submit buttons: give each a `name`/`value`
 * submitter pair (e.g. `name="intent" value="draft"`). Only the clicked
 * button spins; the others merely disable while the action runs. The
 * server reads the same pair off the FormData, so no hidden input is
 * needed to carry the intent.
 */
export function FormButton({
  children,
  pendingLabel,
  disabled,
  name,
  value,
  ...rest
}: Props) {
  const { pending, data } = useFormStatus();
  const mine = ownsPending(pending, data, name, value);
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      loading={mine}
      disabled={disabled || (pending && !mine)}
      {...rest}
    >
      {mine && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
