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

  const success = !!state.info;
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
      {state.info && <SuccessBanner message={state.info} />}
      {state.fieldErrors?.user_type && (
        <Alert kind="error">{state.fieldErrors.user_type}</Alert>
      )}

      {/* key={success} remounts all inputs on success, clearing controlled
          state (password) and resetting defaultValues to empty. On failure
          the key stays "active" so typed values are preserved. */}
      <div key={success ? "reset" : "active"} className="space-y-6">
        <input type="hidden" name="user_type" value={userType} />

        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@club.com"
          required
          defaultValue={success ? "" : values.email}
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
          defaultValue={success ? "" : (values.role_title ?? "")}
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

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-emerald-200 px-5 py-4"
      style={{
        background:
          "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
        boxShadow: "0 6px 16px -6px rgba(16,185,129,.25)",
      }}
    >
      <span
        className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 28,
          height: 28,
          background: "#10b981",
          boxShadow: "0 2px 6px rgba(16,185,129,.4)",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <div>
        <p className="text-[14px] font-extrabold text-emerald-900">
          Account created!
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-emerald-700">
          {message}
        </p>
      </div>
    </div>
  );
}
