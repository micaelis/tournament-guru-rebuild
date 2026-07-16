"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = {
  variant?: "primary" | "ghost" | "danger" | "link";
  size?: "sm" | "md" | "lg";
  pendingLabel?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/**
 * A submit Button that disables itself and shows a pending label while
 * the enclosing form action is running. Drop-in replacement for
 * `<Button type="submit">` in forms driven by useActionState.
 */
export function FormButton({
  children,
  pendingLabel = "…",
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...rest}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
