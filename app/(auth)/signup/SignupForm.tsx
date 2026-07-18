"use client";

import { useActionState } from "react";
import { signupAction, type FormState } from "../actions";
import { Alert, Field, PasswordField, SubmitButton } from "../parts";
import { Select } from "@/app/components/ui/Field";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
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
        <SubmitButton>Create account</SubmitButton>
      </div>
    </form>
  );
}
