"use client";

import { useActionState, useState } from "react";
import { finishOnboarding, type OnboardingState } from "../actions";
import { Stepper } from "@/app/components/ui/Stepper";
import { Button } from "@/app/components/ui/Button";
import { Field } from "@/app/components/ui/Field";
import { SegmentedPills } from "@/app/components/ui/SegmentedPills";
import { FormMessage } from "@/app/components/ui/FormMessage";
import {
  ROLE_OPTIONS,
  ORG_ROLES,
  ORG_REQUIRED,
  USER_GENDER_OPTIONS,
  DISTANCE_OPTIONS,
  COMPETITION_LEVEL_OPTIONS,
  TEAM_GENDER_OPTIONS,
  AGE_OPTIONS,
} from "@/app/lib/onboarding-options";

const STEPS = ["About you", "A few more details", "Preferred Event Criteria"];

type Team = { gender: string; age: string; level: string };
const emptyTeam = (): Team => ({ gender: "", age: "", level: "" });

/* ── DOB helpers ──────────────────────────────────────────────────────────
   Masked text input for DOB so display is always MM/DD/YYYY regardless of the
   browser's locale (Chrome renders type="date" as dd/mm/yyyy on many macOS
   setups). Wire format sent to the server is still ISO (yyyy-mm-dd). */

function formatDobText(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dobTextToISO(text: string): string {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 3000)
    return "";
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd)
    return "";
  return `${m[3]}-${m[1]}-${m[2]}`;
}

function isAdult(iso: string): boolean {
  if (!iso) return false;
  const dob = new Date(iso + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return false;
  const eighteen = new Date();
  eighteen.setFullYear(eighteen.getFullYear() - 18);
  eighteen.setHours(0, 0, 0, 0);
  return dob.getTime() <= eighteen.getTime();
}

export function OnboardingWizard({
  initialFirstName = "",
  initialLastName = "",
}: {
  initialFirstName?: string;
  initialLastName?: string;
}) {
  const [step, setStep] = useState(1);

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [role, setRole] = useState("");
  const [orgName, setOrgName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [gender, setGender] = useState("");
  const [dobText, setDobText] = useState("");
  const [prefDistance, setPrefDistance] = useState("");
  // Team Managers can register up to 3 teams (Bubble user table stored three
  // team slots). Every other role registers a single team.
  const [teams, setTeams] = useState<Team[]>([emptyTeam()]);

  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    role?: string;
    orgName?: string;
    locationText?: string;
    gender?: string;
    dob?: string;
  }>({});

  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    finishOnboarding,
    {},
  );

  const orgRequired = ORG_REQUIRED.includes(
    role as (typeof ORG_REQUIRED)[number],
  );
  const orgApplies = ORG_ROLES.includes(role as (typeof ORG_ROLES)[number]);
  const maxTeams = role === "team_manager" ? 3 : 1;
  const visibleTeams = teams.slice(0, maxTeams);

  const dobISO = dobTextToISO(dobText);

  function next() {
    if (step === 1) {
      const errs: typeof fieldErrors = {};
      if (!firstName.trim()) errs.firstName = "Please enter your first name.";
      if (!lastName.trim()) errs.lastName = "Please enter your last name.";
      if (!role) errs.role = "Please choose the option that best describes you.";
      if (orgRequired && !orgName.trim()) {
        errs.orgName = "Team Managers must enter an organization name.";
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    if (step === 2) {
      const errs: typeof fieldErrors = {};
      if (!locationText.trim()) errs.locationText = "Please enter your location.";
      if (!gender) errs.gender = "Please choose an option.";
      if (!dobText.trim()) errs.dob = "Please enter your date of birth.";
      else if (!dobISO) errs.dob = "Please enter a valid date (MM/DD/YYYY).";
      else if (!isAdult(dobISO)) errs.dob = "You need to be 18+";
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function back() {
    setFieldErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function updateTeam(index: number, patch: Partial<Team>) {
    setTeams((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  }
  function addTeam() {
    setTeams((prev) =>
      prev.length < maxTeams ? [...prev, emptyTeam()] : prev,
    );
  }
  function removeTeam(index: number) {
    setTeams((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    boxShadow: "0 8px 30px -18px rgba(15,23,42,.25)",
    padding: "30px 30px 26px",
  };

  return (
    <div>
      <div style={{ marginBottom: 26 }}>
        <Stepper current={step} steps={STEPS} />
      </div>

      {/* Steps 1 and 2 are plain <div> containers — no <form>, so nothing can
          submit finishOnboarding. Only step 3 renders inside a real <form>. */}

      {step === 1 && (
        <div className="rounded-2xl bg-white" style={cardStyle}>
          <div key="s1" className="tg-step-in">
            <StepHeading
              title="Personal Information"
              subtitle="Tell us a little bit about yourself"
            />
            <div style={{ display: "grid", gap: 18 }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First Name" error={fieldErrors.firstName}>
                  <input
                    className="tg-control"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setFieldErrors((p) => ({ ...p, firstName: undefined }));
                    }}
                    aria-invalid={fieldErrors.firstName ? true : undefined}
                    placeholder="Enter first name"
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="Last Name" error={fieldErrors.lastName}>
                  <input
                    className="tg-control"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setFieldErrors((p) => ({ ...p, lastName: undefined }));
                    }}
                    aria-invalid={fieldErrors.lastName ? true : undefined}
                    placeholder="Enter last name"
                    autoComplete="family-name"
                  />
                </Field>
              </div>

              <Field label="Title" error={fieldErrors.role}>
                <SegmentedPills
                  name="_role_display"
                  ariaLabel="Your role"
                  options={ROLE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  value={role}
                  onChange={(v) => {
                    setRole(v);
                    setFieldErrors((p) => ({
                      ...p,
                      role: undefined,
                      orgName: undefined,
                    }));
                  }}
                  columns={3}
                />
              </Field>

              {/* Org name is always visible — Bubble showed it by default.
                  It's only required when the selected Title is Team Manager. */}
              <Field
                label="Organization Name"
                optional={!orgRequired}
                error={fieldErrors.orgName}
              >
                <input
                  className="tg-control"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setFieldErrors((p) => ({ ...p, orgName: undefined }));
                  }}
                  aria-invalid={fieldErrors.orgName ? true : undefined}
                  placeholder="Your club / company full name"
                  autoComplete="organization"
                />
              </Field>
              {orgApplies === false && role !== "" && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    margin: "-8px 0 0",
                  }}
                >
                  Optional for this role.
                </p>
              )}
            </div>

            <FooterNav
              step={step}
              onBack={back}
              onNext={next}
              pending={false}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-2xl bg-white" style={cardStyle}>
          <div key="s2" className="tg-step-in">
            <StepHeading
              title="A few more details"
              subtitle="Location, gender and date of birth. All required so we can tailor your event matches — and confirm you're 18 or over."
            />
            <div style={{ display: "grid", gap: 18 }}>
              <Field label="Location" error={fieldErrors.locationText}>
                <input
                  className="tg-control"
                  value={locationText}
                  onChange={(e) => {
                    setLocationText(e.target.value);
                    setFieldErrors((p) => ({
                      ...p,
                      locationText: undefined,
                    }));
                  }}
                  aria-invalid={fieldErrors.locationText ? true : undefined}
                  placeholder="City, State"
                  autoComplete="address-level2"
                />
              </Field>

              <Field label="Gender" error={fieldErrors.gender}>
                <SegmentedPills
                  name="_gender_display"
                  ariaLabel="Gender"
                  options={USER_GENDER_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  value={gender}
                  onChange={(v) => {
                    setGender(v);
                    setFieldErrors((p) => ({ ...p, gender: undefined }));
                  }}
                  columns={2}
                />
              </Field>

              <Field label="Date of birth" error={fieldErrors.dob}>
                <input
                  className="tg-control"
                  inputMode="numeric"
                  autoComplete="bday"
                  value={dobText}
                  onChange={(e) => {
                    setDobText(formatDobText(e.target.value));
                    setFieldErrors((p) => ({ ...p, dob: undefined }));
                  }}
                  aria-invalid={fieldErrors.dob ? true : undefined}
                  placeholder="MM/DD/YYYY"
                  maxLength={10}
                />
              </Field>
            </div>

            <FooterNav
              step={step}
              onBack={back}
              onNext={next}
              pending={false}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-2xl bg-white" style={cardStyle}>
          {/* Only step 3 uses a real <form> — so finishOnboarding can only
              ever run when the user clicks "Finish Registration" here. */}
          <form action={formAction}>
            <input type="hidden" name="first_name" value={firstName} />
            <input type="hidden" name="last_name" value={lastName} />
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="org_name" value={orgName} />
            <input type="hidden" name="location_text" value={locationText} />
            <input type="hidden" name="gender" value={gender} />
            <input type="hidden" name="dob" value={dobISO} />
            <input type="hidden" name="pref_distance" value={prefDistance} />
            <input
              type="hidden"
              name="teams"
              value={JSON.stringify(visibleTeams)}
            />

            {state.error && (
              <div style={{ marginBottom: 20 }}>
                <FormMessage tone="error">{state.error}</FormMessage>
              </div>
            )}

            <div key="s3" className="tg-step-in">
              <StepHeading
                title="Preferred Event Criteria"
                subtitle="This information will make your event searching faster, easier, and more aligned with your specific needs"
              />

              <div style={{ display: "grid", gap: 24 }}>
                {/* — Distance — */}
                <section>
                  <SubHeading title="Distance from your location" />
                  <p style={bodyStyle}>
                    Please select the maximum distance your team prefers to
                    travel for events. Your event search results will always
                    start within the parameters you set here. More distance =
                    more events, less distance = less events. This can be
                    adjusted on the <strong>Find Events</strong> page.
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <SegmentedPills
                      name="_distance_display"
                      ariaLabel="Distance from your location"
                      options={DISTANCE_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                      value={prefDistance}
                      onChange={setPrefDistance}
                      columns={4}
                    />
                  </div>
                </section>

                {/* — Your Team's Info — */}
                <section>
                  <SubHeading title="Your Team's Info" />
                  {maxTeams > 1 && (
                    <p style={{ ...bodyStyle, marginTop: 4 }}>
                      As a Team Manager, you can register up to {maxTeams}{" "}
                      teams. Each team gets matched to events independently.
                    </p>
                  )}

                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    {visibleTeams.map((team, index) => (
                      <TeamCard
                        key={index}
                        index={index}
                        team={team}
                        canRemove={visibleTeams.length > 1}
                        onChange={(patch) => updateTeam(index, patch)}
                        onRemove={() => removeTeam(index)}
                      />
                    ))}
                  </div>

                  {maxTeams > 1 && visibleTeams.length < maxTeams && (
                    <button
                      type="button"
                      onClick={addTeam}
                      className="tg-hover"
                      style={{
                        marginTop: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: "1px dashed var(--color-border)",
                        color: "var(--color-accent)",
                        fontSize: 13.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>{" "}
                      Add another team
                    </button>
                  )}
                </section>
              </div>

              <FooterNav
                step={step}
                onBack={back}
                onNext={next}
                pending={pending}
              />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--color-text-secondary)",
  margin: "6px 0 0",
};

function FooterNav({
  step,
  onBack,
  onNext,
  pending,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginTop: 30, gap: 12 }}
    >
      {step > 1 ? (
        <Button type="button" variant="ghost" fullWidth={false} onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}

      {step < 3 ? (
        <Button type="button" fullWidth={false} onClick={onNext}>
          Next Step
        </Button>
      ) : (
        <Button type="submit" fullWidth={false} pending={pending}>
          {pending ? "Finishing…" : "Finish Registration"}
        </Button>
      )}
    </div>
  );
}

function StepHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1
        className="font-heading text-dark"
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          marginTop: 6,
          marginBottom: 0,
          fontSize: 14,
          color: "var(--color-text-secondary)",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function SubHeading({ title }: { title: string }) {
  return (
    <div
      className="font-heading text-dark"
      style={{
        fontSize: 17,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        margin: 0,
      }}
    >
      {title}
    </div>
  );
}

function TeamCard({
  index,
  team,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  team: Team;
  canRemove: boolean;
  onChange: (patch: Partial<Team>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="rounded-2xl"
      style={{
        border: "1px solid var(--color-border)",
        background: "#fff",
        padding: 16,
      }}
    >
      <div
        className="flex items-center justify-between rounded-lg"
        style={{
          background: "#eef2ff",
          padding: "8px 12px",
          marginBottom: 14,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center rounded-full font-bold text-white"
            aria-hidden="true"
            style={{
              width: 22,
              height: 22,
              fontSize: 12,
              background: "#1e3a8a",
            }}
          >
            {index + 1}
          </span>
          <span
            className="font-heading"
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: ".02em",
              color: "#1e3a8a",
            }}
          >
            Team {index + 1}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove team ${index + 1}`}
            style={{
              background: "transparent",
              border: 0,
              color: "#1e3a8a",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            Remove
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <Field label="Gender">
          <SegmentedPills
            name={`_team_${index}_gender_display`}
            ariaLabel="Team gender"
            options={TEAM_GENDER_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={team.gender}
            onChange={(v) => onChange({ gender: v })}
            columns={3}
          />
        </Field>

        <Field label="Age">
          <select
            className="tg-control tg-select"
            value={team.age}
            onChange={(e) => onChange({ age: e.target.value })}
          >
            <option value="">Select Age</option>
            {AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Competitive Level">
          <SegmentedPills
            name={`_team_${index}_level_display`}
            ariaLabel="Competitive level"
            options={COMPETITION_LEVEL_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={team.level}
            onChange={(v) => onChange({ level: v })}
            columns={5}
          />
        </Field>
      </div>
    </div>
  );
}
