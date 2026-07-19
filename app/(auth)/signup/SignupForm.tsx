"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type FormState } from "../actions";
import { Alert, Field, PasswordField, SubmitButton } from "../parts";
import { Select } from "@/app/components/ui/Field";
import { Checkbox } from "@/app/components/ui/Checkbox";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { validateEmail, validatePassword } from "@/lib/validation";
import { rolesFor, type UserTypeValue } from "@/lib/enums";

const INITIAL: FormState = {};

const ROLE_QUESTION: Record<UserTypeValue, string> = {
  attendee: "Are you a coach, parent / spectator, team manager?",
  event_director: "Are you an Event Director, Event Admin, or Club Director?",
};

export default function SignupForm({
  preselectType,
}: {
  preselectType?: UserTypeValue;
}) {
  const userType: UserTypeValue = preselectType ?? "attendee";
  const [state, formAction] = useActionState(signupAction, INITIAL);
  const { values, capture } = useSubmittedValues();

  const roles = rolesFor(userType);

  // Success never renders here: the action redirects (session →
  // /onboarding; confirmations on → /signup/verify-email), so this form
  // only re-renders on FAILED submits — where typed values are preserved.
  return (
    <form
      action={(formData) => {
        capture(formData);
        formAction(formData);
      }}
      className="space-y-6"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.fieldErrors?.user_type && (
        <Alert kind="error">{state.fieldErrors.user_type}</Alert>
      )}

      <div className="space-y-6">
        <input type="hidden" name="user_type" value={userType} />

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
          autoComplete="new-password"
          placeholder="Create a password"
          hint="8+ characters, at least one uppercase letter and one number."
          error={state.fieldErrors?.password}
          validate={validatePassword}
        />

        <Select
          label={ROLE_QUESTION[userType]}
          name="role_title"
          required
          placeholder="Select your role"
          /* React applies a select's defaultValue only at mount, so the
             post-action form reset would blank it — remount on the captured
             value to keep the submitted choice (inputs don't need this). */
          key={values.role_title ?? "unset"}
          defaultValue={values.role_title ?? ""}
          error={state.fieldErrors?.role_title}
          validate={(v) => (v ? null : "Pick a role to continue.")}
        >
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
        <TermsAgreement
          error={state.fieldErrors?.agree_terms}
          defaultChecked={values.agree_terms === "yes"}
        />
        <SubmitButton>Create account</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Required consent row. The `required` attribute is the UX layer only —
 * signupAction re-checks `agree_terms` server-side and returns this field
 * error, so a client that strips the attribute still can't sign up.
 */
function TermsAgreement({
  error,
  defaultChecked,
}: {
  error?: string;
  defaultChecked: boolean;
}) {
  const { shownError, revalidate } = useLiveValidation(error);
  return (
    <div>
      <Checkbox
        name="agree_terms"
        value="yes"
        required
        defaultChecked={defaultChecked}
        aria-invalid={Boolean(shownError) || undefined}
        onChange={(e) => revalidate(e.currentTarget)}
        className="items-start"
        label={
          <>
            I agree to the{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-900 underline underline-offset-2 hover:text-[var(--color-accent)]"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-900 underline underline-offset-2 hover:text-[var(--color-accent)]"
            >
              Legal Terms
            </Link>
          </>
        }
      />
      {shownError && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {shownError}
        </span>
      )}
    </div>
  );
}
