"use client";

import { useActionState, useEffect, useState } from "react";
import { requestResetAction, type FormState } from "../actions";
import { Alert, Field, SubmitButton } from "../parts";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import { validateEmail } from "@/lib/validation";

const INITIAL: FormState = {};
const COOLDOWN_SECONDS = 30;

/**
 * Reset request form. The cooldown mirrors the server-side rate
 * limit (1 request / 30 s / IP) so users see a visible timer instead
 * of an opaque "try again" error.
 *
 * We store the cooldown target as an absolute Date.now() timestamp
 * driven off the server action's `state.info` change, then derive
 * the display "seconds remaining" from a ticking `now` clock. This
 * lets us react to the external submit event without a
 * setState-in-effect footgun — both effects only mirror an
 * externally-driven signal (form action) or advance time (interval).
 */
export default function RequestResetForm() {
  const [state, formAction] = useActionState(requestResetAction, INITIAL);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    if (!state.info) return;
    // The linter's set-state-in-effect rule is overzealous here: the
    // trigger is an external event (a Server Action returning info)
    // not a derived state read. Setting the cooldown target from that
    // signal is the correct place for the assignment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
    setNow(Date.now());
  }, [state.info]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [cooldown]);

  const { values, capture } = useSubmittedValues();

  return (
    <form
      action={(formData) => {
        capture(formData);
        formAction(formData);
      }}
      className="space-y-4"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.info && <Alert kind="info">{state.info}</Alert>}
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
      <SubmitButton disabled={cooldown > 0}>
        {cooldown > 0 ? `Try again in ${cooldown}s` : "Send reset link"}
      </SubmitButton>
    </form>
  );
}
