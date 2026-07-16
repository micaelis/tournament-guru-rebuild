"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "../../(auth)/parts";
import { LocationAutocomplete } from "@/app/components/LocationAutocomplete";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import { isAdultDob } from "@/lib/validation";
import {
  saveStep1,
  saveStep2,
  saveStep3,
  saveStep4,
  type OnboardingState,
} from "./actions";
import {
  AGE_BRACKETS,
  ATTENDEE_ROLES,
  COMPETITION_LEVELS,
  DISTANCE_PREFS,
  ED_ROLES,
  ORG_OPTIONAL_ROLES,
  TEAM_GENDERS,
  USER_GENDERS,
} from "@/lib/enums";
import { signOutAction } from "../../(auth)/actions";

const INITIAL: OnboardingState = {};

type Profile = {
  first_name: string | null;
  last_name: string | null;
  role_title: string;
  organization_title: string | null;
  location_formatted: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_place_id: string | null;
  location_city: string | null;
  location_state_full: string | null;
  location_state_abbr: string | null;
  location_zip: string | null;
  user_gender: string | null;
  dob: string | null;
  distance_pref: string | null;
  org_description: string | null;
  org_logo_url: string | null;
};

export default function OnboardingWizard({
  step,
  userType,
  profile,
}: {
  step: 1 | 2 | 3 | 4;
  userType: "attendee" | "event_director" | "admin";
  profile: Profile;
}) {
  const totalSteps = userType === "event_director" ? 4 : 3;
  return (
    <div className="max-w-lg">
      <Header step={step} totalSteps={totalSteps} />
      <div className="mt-8">
        {step === 1 && (
          <Step1Form userType={userType} profile={profile} />
        )}
        {step === 2 && <Step2Form profile={profile} />}
        {step === 3 && (
          <Step3Form userType={userType} profile={profile} />
        )}
        {step === 4 && <Step4Form profile={profile} />}
      </div>
      <div className="mt-8 text-sm text-slate-500">
        Wrong account?{" "}
        <form action={signOutAction} className="inline">
          <button type="submit" className="font-semibold text-slate-700 underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Header({ step, totalSteps }: { step: number; totalSteps: number }) {
  const labels = [
    "Personal Information",
    "About You",
    "Preferred Event Criteria",
    "Your Organization",
  ];
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => {
          const active = n === step;
          const done = n < step;
          return (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                done
                  ? "bg-slate-900"
                  : active
                    ? "bg-red-600"
                    : "bg-slate-200"
              }`}
            />
          );
        })}
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        Step {step} of {totalSteps}
      </p>
      <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
        {labels[step - 1]}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {step === 1 && "Tell us a little about yourself."}
        {step === 2 && "Where are you and when's your birthday?"}
        {step === 3 &&
          "This information will make your event searching faster, easier, and more aligned with your specific needs. Feel free to skip anything."}
        {step === 4 &&
          "Just a couple more details so attendees know who they're seeing."}
      </p>
    </div>
  );
}

function Step1Form({
  userType,
  profile,
}: {
  userType: Profile extends never ? never : "attendee" | "event_director" | "admin";
  profile: Profile;
}) {
  const [state, formAction] = useActionState(saveStep1, INITIAL);
  const { values, capture } = useSubmittedValues();
  const roles = userType === "event_director" ? ED_ROLES : ATTENDEE_ROLES;
  const { shownError: roleError, revalidate: revalidateRole } =
    useLiveValidation(state.fieldErrors?.role_title, (value) =>
      roles.some((r) => r.value === value) ? null : "Pick a role to continue.",
    );
  const orgLabel = userType === "event_director" ? "Organization title" : "Club affiliation";
  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="space-y-5"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="First name"
          name="first_name"
          defaultValue={values.first_name ?? profile.first_name ?? ""}
          required
          validate={(v) => (v.trim() ? null : "First name is required.")}
          error={state.fieldErrors?.first_name}
        />
        <Field
          label="Last name"
          name="last_name"
          defaultValue={values.last_name ?? profile.last_name ?? ""}
          required
          validate={(v) => (v.trim() ? null : "Last name is required.")}
          error={state.fieldErrors?.last_name}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-slate-800">
          Role
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
                defaultChecked={
                  values.role_title
                    ? values.role_title === role.value
                    : profile.role_title === role.value
                }
                onChange={(e) => revalidateRole(e.currentTarget)}
                className="sr-only"
              />
              {role.label}
            </label>
          ))}
        </div>
        {roleError && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {roleError}
          </p>
        )}
      </fieldset>
      <Field
        label={orgLabel}
        name="organization_title"
        defaultValue={values.organization_title ?? profile.organization_title ?? ""}
        hint={
          ORG_OPTIONAL_ROLES.has(profile.role_title)
            ? "Optional for parents / spectators."
            : undefined
        }
        validate={(v) => (v.trim() ? null : "Required.")}
        error={state.fieldErrors?.organization_title}
      />
      <SubmitButton>Continue</SubmitButton>
    </form>
  );
}

function Step2Form({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(saveStep2, INITIAL);
  const { values, capture } = useSubmittedValues();
  const { shownError: genderError, revalidate: revalidateGender } =
    useLiveValidation(state.fieldErrors?.user_gender, (value) =>
      USER_GENDERS.some((g) => g.value === value)
        ? null
        : "Pick one to continue.",
    );
  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="space-y-5"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <LocationAutocomplete
        label="Location"
        name="location"
        fieldPrefix="location"
        placeholder="City, State, or Zip Code"
        defaultValue={profile.location_formatted ?? ""}
        defaultGeo={{
          lat: profile.location_lat != null ? String(profile.location_lat) : "",
          lng: profile.location_lng != null ? String(profile.location_lng) : "",
          place_id: profile.location_place_id ?? "",
          city: profile.location_city ?? "",
          state_full: profile.location_state_full ?? "",
          state_abbr: profile.location_state_abbr ?? "",
          zip: profile.location_zip ?? "",
        }}
        required
        hint="Where do you spend most of your season? We use this to sort events by distance."
        validate={(v) => (v.trim() ? null : "Location is required.")}
        error={state.fieldErrors?.location}
      />
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-slate-800">
          Gender
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {USER_GENDERS.map((g) => (
            <label
              key={g.value}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-center text-sm font-semibold text-slate-800 has-[input:checked]:border-slate-900 has-[input:checked]:bg-slate-900 has-[input:checked]:text-white"
            >
              <input
                type="radio"
                name="user_gender"
                value={g.value}
                defaultChecked={
                  values.user_gender
                    ? values.user_gender === g.value
                    : profile.user_gender === g.value
                }
                onChange={(e) => revalidateGender(e.currentTarget)}
                className="sr-only"
              />
              {g.label}
            </label>
          ))}
        </div>
        {genderError && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {genderError}
          </p>
        )}
      </fieldset>
      <Field
        label="Date of birth"
        name="dob"
        type="date"
        defaultValue={values.dob ?? profile.dob ?? ""}
        required
        validate={(v) =>
          v && isAdultDob(v) ? null : "You must be at least 18."
        }
        error={state.fieldErrors?.dob}
      />
      <SubmitButton>Continue</SubmitButton>
    </form>
  );
}

function Step3Form({
  userType,
  profile,
}: {
  userType: "attendee" | "event_director" | "admin";
  profile: Profile;
}) {
  const [state, formAction] = useActionState(saveStep3, INITIAL);
  const { values, capture } = useSubmittedValues();
  const isParent = profile.role_title === "parent_spectator";
  const teamCount = isParent ? 1 : 3;
  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="space-y-6"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-slate-800">
          Distance from your location
        </legend>
        <p className="mb-3 text-xs text-slate-500">
          Maximum distance your team prefers to travel for events. Adjustable
          later on Find Events.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DISTANCE_PREFS.map((d) => (
            <label
              key={d.value}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-center text-sm font-semibold text-slate-800 has-[input:checked]:border-slate-900 has-[input:checked]:bg-slate-900 has-[input:checked]:text-white"
            >
              <input
                type="radio"
                name="distance_pref"
                value={d.value}
                defaultChecked={
                  values.distance_pref
                    ? values.distance_pref === d.value
                    : profile.distance_pref === d.value
                }
                className="sr-only"
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-4">
        <p className="text-[13px] font-semibold text-slate-800">
          Your team{teamCount > 1 ? "s" : ""}
        </p>
        {Array.from({ length: teamCount }, (_, i) => i + 1).map((slot) => (
          <TeamSlot key={slot} slot={slot} values={values} />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>All fields optional.</span>
        <SubmitButton className="!w-auto">
          {userType === "event_director" ? "Continue" : "Finish"}
        </SubmitButton>
      </div>
    </form>
  );
}

function TeamSlot({
  slot,
  values,
}: {
  slot: number;
  values: Record<string, string>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        Team {slot}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Gender
          </span>
          <select
            name={`team_${slot}_gender`}
            className="tg-control tg-select"
            defaultValue={values[`team_${slot}_gender`] ?? ""}
          >
            <option value="">—</option>
            {TEAM_GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Age
          </span>
          <select
            name={`team_${slot}_age`}
            className="tg-control tg-select"
            defaultValue={values[`team_${slot}_age`] ?? ""}
          >
            <option value="">—</option>
            {AGE_BRACKETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Level
          </span>
          <select
            name={`team_${slot}_level`}
            className="tg-control tg-select"
            defaultValue={values[`team_${slot}_level`] ?? ""}
          >
            <option value="">—</option>
            {COMPETITION_LEVELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function Step4Form({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(saveStep4, INITIAL);
  const { values, capture } = useSubmittedValues();
  const { shownError: descriptionError, revalidate: revalidateDescription } =
    useLiveValidation(state.fieldErrors?.org_description, (value) =>
      value.trim() ? null : "Tell attendees who your organization is.",
    );
  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="space-y-5"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="Organization logo URL"
        name="org_logo_url"
        type="url"
        defaultValue={values.org_logo_url ?? profile.org_logo_url ?? ""}
        placeholder="https://…"
        hint="Optional for now — you'll be able to upload a file from your Account settings."
        error={state.fieldErrors?.org_logo_url}
      />
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
          Organization description
        </span>
        <textarea
          name="org_description"
          defaultValue={values.org_description ?? profile.org_description ?? ""}
          rows={5}
          required
          onInput={(e) => revalidateDescription(e.currentTarget)}
          aria-invalid={descriptionError ? true : undefined}
          className="tg-control resize-none"
        />
        {descriptionError && (
          <span className="mt-1 block text-xs font-medium text-red-600">
            {descriptionError}
          </span>
        )}
      </label>
      <SubmitButton>Finish onboarding</SubmitButton>
    </form>
  );
}
