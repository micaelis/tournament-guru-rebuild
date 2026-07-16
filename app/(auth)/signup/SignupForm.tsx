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

/**
 * The user type is decided by the entry point, never inside the form:
 * "attendee" by default, "event_director" when arriving from a claim CTA
 * (?type=event_director). The visible choice is only the role dropdown.
 */
export default function SignupForm({
  preselectType,
}: {
  preselectType?: UserTypeValue;
}) {
  const userType: UserTypeValue = preselectType ?? "attendee";
  const [state, formAction] = useActionState(signupAction, INITIAL);
  const { values, capture } = useSubmittedValues();

  const roles = rolesFor(userType);

  return (
    <form
      action={(formData) => {
        capture(formData);
        formAction(formData);
      }}
      className="space-y-6"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.info && <Alert kind="info">{state.info}</Alert>}
      {/* Only reachable by tampering with the hidden input — surfaced so a
          server rejection is never silent. */}
      {state.fieldErrors?.user_type && (
        <Alert kind="error">{state.fieldErrors.user_type}</Alert>
      )}

      <input type="hidden" name="user_type" value={userType} />

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
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
