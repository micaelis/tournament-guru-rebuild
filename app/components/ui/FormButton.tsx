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
 * A submit Button that reads the enclosing form action's pending state
 * and shows the shared spinner (plus an optional label swap) while it
 * runs. Drop-in replacement for `<Button type="submit">` in forms
 * driven by useActionState.
 */
export function FormButton({
  children,
  pendingLabel,
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={disabled} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
