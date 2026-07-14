"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthState } from "../actions";
import { TextInput, PasswordInput } from "@/app/components/ui/Field";
import { Button } from "@/app/components/ui/Button";
import { FormMessage } from "@/app/components/ui/FormMessage";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string | null;
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    login,
    initialError ? { error: initialError } : {},
  );

  return (
    <div>
      {state.code === "migrated" ? (
        <div style={{ marginBottom: 18 }}>
          <FormMessage tone="info" title="Welcome back!">
            For security, we’ve upgraded our system and you’ll need to reset your
            password to continue.
            <span style={{ display: "block", marginTop: 12 }}>
              <Link
                href={`/reset?email=${encodeURIComponent(state.email ?? "")}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 10,
                  background: "var(--color-accent)",
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Reset password →
              </Link>
            </span>
          </FormMessage>
        </div>
      ) : (
        state.error && (
          <div style={{ marginBottom: 18 }}>
            <FormMessage tone="error">{state.error}</FormMessage>
          </div>
        )
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
          <div>
            <PasswordInput
              label="Password"
              name="password"
              autoComplete="current-password"
              placeholder="Type your password"
              required
            />
            <div style={{ marginTop: 8, textAlign: "right" }}>
              <Link
                href="/reset"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-accent)",
                  textDecoration: "none",
                }}
              >
                Forgot your password? Reset it here
              </Link>
            </div>
          </div>
          <Button type="submit" pending={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>
    </div>
  );
}
