"use client";

import { useActionState, useState } from "react";
import { loginAction, type FormState } from "../actions";
import { Alert, BlockedModal, Field, PasswordField, SubmitButton } from "../parts";
import { TextLink } from "@/app/components/ui";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import { validateEmail } from "@/lib/validation";

const INITIAL: FormState = {};

export default function LoginForm({
  next,
  initialInfo,
}: {
  next?: string;
  initialInfo?: string;
}) {
  const [state, formAction] = useActionState(loginAction, INITIAL);
  const [dismissed, setDismissed] = useState(false);
  const { values, capture } = useSubmittedValues();
  const blocked = state.error === "blocked" && !dismissed;

  return (
    <>
      <form
        action={(formData) => {
          capture(formData);
          formAction(formData);
        }}
        className="space-y-4"
      >
        {next && <input type="hidden" name="next" value={next} />}
        {state.error && state.error !== "blocked" && (
          <Alert kind="error">{state.error}</Alert>
        )}
        {(state.info ?? initialInfo) && !state.error && (
          <Alert kind="info">{state.info ?? initialInfo}</Alert>
        )}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@club.com"
          required
          defaultValue={values.email}
          error={state.fieldErrors?.email}
          validate={validateEmail}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={state.fieldErrors?.password}
          labelAccessory={
            <TextLink href="/reset" className="text-[12.5px]">
              Forgot password?
            </TextLink>
          }
        />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      {blocked && <BlockedModal onDismiss={() => setDismissed(true)} />}
    </>
  );
}
