"use client";

import { useActionState } from "react";
import { updatePasswordAction, type FormState } from "../../actions";
import { Alert, PasswordField, SubmitButton } from "../../parts";
import { validatePassword } from "@/lib/validation";

const INITIAL: FormState = {};

export default function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, INITIAL);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        placeholder="Create a new password"
        hint="8+ characters, at least one uppercase letter and one number."
        error={state.fieldErrors?.password}
        validate={validatePassword}
      />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
