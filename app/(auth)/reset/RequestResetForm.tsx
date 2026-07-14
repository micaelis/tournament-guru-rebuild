"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthState } from "../actions";
import { TextInput } from "@/app/components/ui/Field";
import { Button } from "@/app/components/ui/Button";
import { FormMessage } from "@/app/components/ui/FormMessage";

export function RequestResetForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.code === "reset-sent") {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <FormMessage tone="success" title="Check your email">
          Check your email for a password reset link. It may take a minute to
          arrive — be sure to check your spam folder too.
        </FormMessage>
        <Link
          href="/login"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--color-accent)",
            textDecoration: "none",
          }}
        >
          ← Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      {state.error && (
        <div style={{ marginBottom: 18 }}>
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      )}
      <form action={formAction} noValidate>
        <div style={{ display: "grid", gap: 16 }}>
          <TextInput
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@mail.com"
            defaultValue={initialEmail}
            required
          />
          <Button type="submit" pending={pending}>
            {pending ? "Sending link…" : "Send reset link"}
          </Button>
        </div>
      </form>
      <p style={{ marginTop: 20, marginBottom: 0, textAlign: "center" }}>
        <Link
          href="/login"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            textDecoration: "none",
          }}
        >
          ← Back to log in
        </Link>
      </p>
    </div>
  );
}
