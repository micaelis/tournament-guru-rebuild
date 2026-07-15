"use client";

import { useActionState, useEffect } from "react";
import { Alert, Field } from "@/app/(auth)/parts";
import { Button, useToast } from "@/app/components/ui";
import { submitSupportMessage, type SupportState } from "./actions";

const INITIAL: SupportState = {};

/**
 * Client-side contact form. Uses the standard useActionState pattern;
 * the confirmation toast fires when the server returns an info
 * message.
 */
export function SupportForm({
  defaultEmail,
  defaultName,
}: {
  defaultEmail: string;
  defaultName: string;
}) {
  const [state, formAction] = useActionState(submitSupportMessage, INITIAL);
  const { push } = useToast();

  useEffect(() => {
    if (state.info) push("success", state.info);
  }, [state.info, push]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="font-[var(--font-heading)] text-xl font-extrabold text-slate-900">
        Message the team
      </h2>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="Email"
        name="email"
        type="email"
        required
        defaultValue={defaultEmail}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Full name"
        name="name"
        required
        defaultValue={defaultName}
        error={state.fieldErrors?.name}
      />
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
          Message
        </span>
        <textarea
          name="message"
          rows={5}
          required
          placeholder="Describe your problem"
          className="tg-control resize-none"
        />
        {state.fieldErrors?.message && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {state.fieldErrors.message}
          </p>
        )}
      </label>
      <div className="flex justify-end">
        <Button type="submit">Send message</Button>
      </div>
    </form>
  );
}
