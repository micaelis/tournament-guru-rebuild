"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, type FormState } from "../actions";
import { Alert, BlockedModal, Field, SubmitButton } from "../parts";

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
  const blocked = state.error === "blocked" && !dismissed;

  return (
    <>
      <form action={formAction} className="space-y-4">
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
          required
          error={state.fieldErrors?.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <div className="text-right text-sm">
          <Link href="/reset" className="font-semibold text-slate-700">
            Forgot password?
          </Link>
        </div>
        <SubmitButton>Sign in</SubmitButton>
      </form>
      {blocked && <BlockedModal onDismiss={() => setDismissed(true)} />}
    </>
  );
}
