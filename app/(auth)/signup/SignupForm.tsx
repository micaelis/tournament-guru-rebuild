"use client";

import { useActionState, useState } from "react";
import { signupAction, type FormState } from "../actions";
import { Alert, Field, SubmitButton } from "../parts";
import {
  ATTENDEE_ROLES,
  ED_ROLES,
  USER_TYPES,
  type UserTypeValue,
} from "@/lib/enums";

const INITIAL: FormState = {};

export default function SignupForm({
  preselectType,
}: {
  preselectType?: UserTypeValue;
}) {
  const [userType, setUserType] = useState<UserTypeValue | "">(
    preselectType ?? "",
  );
  const [state, formAction] = useActionState(signupAction, INITIAL);

  const roles =
    userType === "event_director"
      ? ED_ROLES
      : userType === "attendee"
        ? ATTENDEE_ROLES
        : [];

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.info && <Alert kind="info">{state.info}</Alert>}

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-slate-800">
          Which side of Tournament Guru are you on?
        </legend>
        <input type="hidden" name="user_type" value={userType} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {USER_TYPES.map((option) => {
            const active = userType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setUserType(option.value)}
                className={`rounded-xl border p-4 text-left text-sm transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                }`}
              >
                <span className="font-bold">{option.label}</span>
                <span
                  className={`mt-1 block text-xs ${
                    active ? "text-white/70" : "text-slate-500"
                  }`}
                >
                  {option.value === "attendee"
                    ? "Coach, team manager, parent or spectator"
                    : "Event Director, Event Admin, or Club Director"}
                </span>
              </button>
            );
          })}
        </div>
        {state.fieldErrors?.user_type && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {state.fieldErrors.user_type}
          </p>
        )}
      </fieldset>

      {userType && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-slate-800">
            Pick your role
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {roles.map((role) => (
              <label
                key={role.value}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-center text-sm font-semibold text-slate-800 has-[input:checked]:border-slate-900 has-[input:checked]:bg-slate-900 has-[input:checked]:text-white"
              >
                <input
                  type="radio"
                  name="role_title"
                  value={role.value}
                  className="sr-only"
                  required
                />
                {role.label}
              </label>
            ))}
          </div>
          {state.fieldErrors?.role_title && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {state.fieldErrors.role_title}
            </p>
          )}
        </fieldset>
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
        autoComplete="new-password"
        required
        hint="8+ characters, at least one uppercase letter and one number."
        error={state.fieldErrors?.password}
      />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
