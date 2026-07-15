"use client";

import { useActionState } from "react";
import { updatePasswordAction, type FormState } from "../../actions";
import { Alert, Field, SubmitButton } from "../../parts";

const INITIAL: FormState = {};

export default function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, INITIAL);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="8+ characters, at least one uppercase letter and one number."
        error={state.fieldErrors?.password}
      />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
