"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthState } from "../actions";
import { TextInput, PasswordInput } from "@/app/components/ui/Field";
import { Button } from "@/app/components/ui/Button";
import { FormMessage } from "@/app/components/ui/FormMessage";

export function SignupForm({ next }: { next?: string | null }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signup,
    {},
  );

  // Confirmation email sent → swap the form for a check-your-inbox panel.
  if (state.code === "confirm") {
    return (
      <FormMessage tone="success" title="Check your inbox">
        We’ve sent a confirmation link to <strong>{state.email}</strong>. Click
        it to activate your account, then you’ll continue to a quick setup.
      </FormMessage>
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
        {next && <input type="hidden" name="next" value={next} />}
        <div style={{ display: "grid", gap: 16 }}>
          <TextInput
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@mail.com"
            required
          />
          <PasswordInput
            label="Password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            minLength={8}
            required
            hint="Use at least 8 characters."
          />
          <Button type="submit" pending={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </div>
      </form>

      <p
        style={{
          marginTop: 22,
          marginBottom: 0,
          textAlign: "center",
          fontSize: 13.5,
          color: "var(--color-text-muted)",
        }}
      >
        <Link
          href="/events"
          style={{ color: "var(--color-text-secondary)", fontWeight: 600, textDecoration: "none" }}
        >
          Skip registration → browse without an account
        </Link>
      </p>
    </div>
  );
}
