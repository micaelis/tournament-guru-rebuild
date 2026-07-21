"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState, useState } from "react";
import { Alert, Field, SubmitButton } from "../../(auth)/parts";
import { ImageUploadField, textLinkClass } from "@/app/components/ui";
import { USDateField } from "@/app/components/ui/USDateInput";
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
  COMPETITION_LEVELS,
  DISTANCE_PREFS,
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
    <div className="w-full max-w-xl">
      <Header step={step} totalSteps={totalSteps} />
      <div className="mt-8">
        {step === 1 && (
          <Step1Form userType={userType} profile={profile} />
        )}
        {step === 2 && <Step2Form profile={profile} back={1} />}
        {step === 3 && (
          <Step3Form userType={userType} profile={profile} back={2} />
        )}
        {step === 4 && <Step4Form profile={profile} back={3} />}
      </div>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-8 text-center">
      <div className="text-sm text-slate-500">
        Wrong account?{" "}
        <form action={signOutAction} className="inline">
          <button type="submit" className={textLinkClass}>
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
  const subtitles = [
    "Tell us a little about yourself.",
    "Where are you and when’s your birthday?",
    "Help us match the right events for you. Everything here is optional — you can always adjust later.",
    "Just a couple more details so attendees know who they’re seeing.",
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
              className={`h-1.5 flex-1 rounded-full transition-colors ${
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
        {subtitles[step - 1]}
      </p>
    </div>
  );
}

function BackLink({ to }: { to: number }) {
  return (
    <Link
      href={`/onboarding?step=${to}` as Route}
      className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </Link>
  );
}

function ButtonRow({ back, children }: { back?: number; children: React.ReactNode }) {
  if (!back) return <>{children}</>;
  return (
    <div className="flex gap-3">
      <div className="w-28 shrink-0">
        <BackLink to={back} />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ── Shared chip styles ── */

function Chip({
  name,
  value,
  label,
  defaultChecked,
  onChange,
  type = "radio",
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: "radio" | "checkbox";
}) {
  return (
    <label
      className="cursor-pointer select-none rounded-full border px-5 py-2.5 text-center text-sm font-semibold transition-all duration-150 border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:shadow-md active:scale-95 has-[input:checked]:border-slate-900 has-[input:checked]:bg-slate-900 has-[input:checked]:text-white has-[input:checked]:shadow-lg has-[input:checked]:scale-[1.02]"
    >
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function SectionLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-[13px] font-semibold text-slate-800">{label}</p>
      {hint && (
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

/* ── Step 1 ── */

function Step1Form({
  userType,
  profile,
}: {
  userType: Profile extends never ? never : "attendee" | "event_director" | "admin";
  profile: Profile;
}) {
  const [state, formAction] = useActionState(saveStep1, INITIAL);
  const { values, capture } = useSubmittedValues();
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
          placeholder="Jane"
          defaultValue={values.first_name ?? profile.first_name ?? ""}
          required
          validate={(v) => (v.trim() ? null : "First name is required.")}
          error={state.fieldErrors?.first_name}
        />
        <Field
          label="Last name"
          name="last_name"
          placeholder="Doe"
          defaultValue={values.last_name ?? profile.last_name ?? ""}
          required
          validate={(v) => (v.trim() ? null : "Last name is required.")}
          error={state.fieldErrors?.last_name}
        />
      </div>
      <Field
        label={orgLabel}
        name="organization_title"
        placeholder={userType === "event_director" ? "e.g. Florida Premier FC" : "e.g. Tampa Bay United"}
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

/* ── Step 2 ── */

function Step2Form({ profile, back }: { profile: Profile; back?: number }) {
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
        <div className="flex flex-wrap gap-2">
          {USER_GENDERS.map((g) => (
            <Chip
              key={g.value}
              name="user_gender"
              value={g.value}
              label={g.label}
              defaultChecked={
                values.user_gender
                  ? values.user_gender === g.value
                  : profile.user_gender === g.value
              }
              onChange={(e) => revalidateGender(e.currentTarget)}
            />
          ))}
        </div>
        {genderError && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {genderError}
          </p>
        )}
      </fieldset>
      <USDateField
        label="Date of birth"
        name="dob"
        defaultIso={values.dob ?? profile.dob ?? ""}
        required
        hint="mm/dd/yyyy — you must be at least 18."
        validate={(v) =>
          v && isAdultDob(v) ? null : "You must be at least 18."
        }
        error={state.fieldErrors?.dob}
      />
      <ButtonRow back={back}>
        <SubmitButton>Continue</SubmitButton>
      </ButtonRow>
    </form>
  );
}

/* ── Step 3 — Preferred Event Criteria ── */

function Step3Form({
  userType,
  profile,
  back,
}: {
  userType: "attendee" | "event_director" | "admin";
  profile: Profile;
  back?: number;
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
      className="space-y-8"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}

      {/* ── Distance ── */}
      <fieldset className="rounded-2xl border border-slate-200/80 bg-white/60 p-5 backdrop-blur-sm">
        <SectionLabel
          label="Travel distance"
          hint="How far are you willing to travel? You can always change this later."
        />
        <div className="flex flex-wrap gap-2">
          {DISTANCE_PREFS.map((d) => (
            <Chip
              key={d.value}
              name="distance_pref"
              value={d.value}
              label={d.label}
              defaultChecked={
                values.distance_pref
                  ? values.distance_pref === d.value
                  : profile.distance_pref === d.value
              }
            />
          ))}
        </div>
      </fieldset>

      {/* ── Teams ── */}
      <div className="space-y-4">
        <SectionLabel
          label="Team details"
          hint={
            teamCount > 1
              ? "Add up to 3 teams — we'll tailor results to all of them."
              : "Tell us about your team so we can match the right events."
          }
        />
        {Array.from({ length: teamCount }, (_, i) => i + 1).map((slot) => (
          <TeamSlot
            key={slot}
            slot={slot}
            values={values}
            teamCount={teamCount}
          />
        ))}
      </div>

      {/* ── Submit ── */}
      <div className="space-y-4 pt-1">
        <ButtonRow back={back}>
          <SubmitButton>
            {userType === "event_director" ? "Continue" : "Finish"}
          </SubmitButton>
        </ButtonRow>
        <p className="text-center text-xs text-slate-500">
          Everything on this page is optional — skip anything.
        </p>
        {userType !== "event_director" && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-5 py-4 text-center">
            <p className="text-sm text-slate-500">
              Want to look around first?
            </p>
            <Link
              href={"/events" as Route}
              className="mt-1 inline-block text-sm font-bold text-slate-800 underline decoration-slate-400 decoration-2 underline-offset-[3px] transition-colors hover:text-[var(--color-accent)] hover:decoration-[var(--color-accent)]"
            >
              Skip &amp; browse events
            </Link>
          </div>
        )}
      </div>
    </form>
  );
}

function TeamSlot({
  slot,
  values,
  teamCount,
}: {
  slot: number;
  values: Record<string, string>;
  teamCount: number;
}) {
  const hasValues = Boolean(
    values[`team_${slot}_gender`] ||
      values[`team_${slot}_age`] ||
      values[`team_${slot}_level`],
  );

  const card = (
    <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-[0_10px_26px_-18px_rgba(15,23,42,.25)] backdrop-blur-sm">
      {teamCount > 1 && (
        <div className="mb-4 flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 font-[var(--font-heading)] text-[12px] font-extrabold text-white">
            {slot}
          </span>
          <span className="font-[var(--font-heading)] text-[15px] font-extrabold text-slate-900">
            Team {slot}
          </span>
        </div>
      )}
      <TeamSlotFields slot={slot} values={values} />
    </div>
  );

  // Progressive disclosure: only Team 1 starts expanded; extra slots
  // render as an "+ Add" affordance. The <details> keeps its inputs in
  // the DOM (empty values post harmlessly), and a failed submit with
  // preserved values re-opens the slot.
  if (slot === 1 || teamCount === 1) return card;
  return (
    <details className="group" open={hasValues}>
      <summary className="flex cursor-pointer select-none items-center gap-2.5 rounded-2xl border border-dashed border-slate-300 bg-white/50 px-5 py-3.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-800 group-open:hidden [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-[14px] font-bold text-slate-500">
          +
        </span>
        Add Team {slot}
        <span className="font-normal text-slate-400">· optional</span>
      </summary>
      {card}
    </details>
  );
}

function TeamSlotFields({
  slot,
  values,
}: {
  slot: number;
  values: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
        {/* Gender — chips */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-700">
            Division
          </legend>
          <div className="flex flex-wrap gap-2">
            {TEAM_GENDERS.map((g) => (
              <Chip
                key={g.value}
                name={`team_${slot}_gender`}
                value={g.value}
                label={g.label}
                defaultChecked={values[`team_${slot}_gender`] === g.value}
              />
            ))}
          </div>
        </fieldset>

        {/* Age — dropdown (too many options for chips) */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Age group
          </span>
          {/* key: select defaultValue applies only at mount — remount on the
              captured value so a failed submit keeps the chosen age. */}
          <select
            name={`team_${slot}_age`}
            key={values[`team_${slot}_age`] ?? "unset"}
            className="tg-control tg-select transition-all"
            defaultValue={values[`team_${slot}_age`] ?? ""}
          >
            <option value="">Select age group</option>
            {AGE_BRACKETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        {/* Competitive level — chips */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-700">
            Competitive level
          </legend>
          <div className="flex flex-wrap gap-2">
            {COMPETITION_LEVELS.map((c) => (
              <Chip
                key={c.value}
                name={`team_${slot}_level`}
                value={c.value}
                label={c.label}
                defaultChecked={values[`team_${slot}_level`] === c.value}
              />
            ))}
          </div>
        </fieldset>
    </div>
  );
}

/* ── Step 4 ── */

function Step4Form({ profile, back }: { profile: Profile; back?: number }) {
  const [state, formAction] = useActionState(saveStep4, INITIAL);
  const { values, capture } = useSubmittedValues();
  const [orgLogoUrl, setOrgLogoUrl] = useState(
    values.org_logo_url ?? profile.org_logo_url ?? "",
  );
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
      <ImageUploadField
        label="Organization logo"
        name="org_logo_url"
        bucket="org-logos"
        value={orgLogoUrl}
        onChange={setOrgLogoUrl}
        hint="Optional — PNG or JPG up to 5 MB, or paste a hosted URL."
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
          placeholder="Tell potential attendees about your organization, history, and what makes your events special..."
          onInput={(e) => revalidateDescription(e.currentTarget)}
          aria-invalid={descriptionError ? true : undefined}
          className="tg-control resize-none transition-all"
        />
        {descriptionError && (
          <span className="mt-1 block text-xs font-medium text-red-600">
            {descriptionError}
          </span>
        )}
      </label>
      <ButtonRow back={back}>
        <SubmitButton>Finish onboarding</SubmitButton>
      </ButtonRow>
    </form>
  );
}
