"use client";

import { useActionState, useEffect, useState } from "react";
import { requestResetAction, type FormState } from "../actions";
import { Alert, Field, SubmitButton } from "../parts";

const INITIAL: FormState = {};
const COOLDOWN_SECONDS = 30;

/**
 * Reset request form. Client-side cooldown mirrors the server-side
 * rate limit (1 request per 30 seconds per IP) so users get a visible
 * timer instead of a mysterious "try again" error.
 */
export default function RequestResetForm() {
  const [state, formAction] = useActionState(requestResetAction, INITIAL);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    // Only start the cooldown once we know the server accepted the send.
    if (state.info) setCooldown(COOLDOWN_SECONDS);
  }, [state.info]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.info && <Alert kind="info">{state.info}</Alert>}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <SubmitButton disabled={cooldown > 0}>
        {cooldown > 0 ? `Try again in ${cooldown}s` : "Send reset link"}
      </SubmitButton>
    </form>
  );
}
