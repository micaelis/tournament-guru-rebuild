"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword, type AuthState } from "../../actions";
import { PasswordInput } from "@/app/components/ui/Field";
import { Button } from "@/app/components/ui/Button";
import { FormMessage } from "@/app/components/ui/FormMessage";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <div>
      {state.error && (
        <div style={{ marginBottom: 18 }}>
          <FormMessage tone="error">
            {state.error}{" "}
            {/expired/i.test(state.error) && (
              <Link href="/reset" style={{ color: "inherit", fontWeight: 700 }}>
                Request a new link →
              </Link>
            )}
          </FormMessage>
        </div>
      )}
      <form action={formAction} noValidate>
        <div style={{ display: "grid", gap: 16 }}>
          <PasswordInput
            label="New password"
            name="password"
            autoComplete="new-password"
            placeholder="Enter a new password"
            minLength={8}
            required
            hint="Use at least 8 characters."
          />
          <PasswordInput
            label="Confirm new password"
            name="confirm"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            minLength={8}
            required
          />
          <Button type="submit" pending={pending}>
            {pending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
