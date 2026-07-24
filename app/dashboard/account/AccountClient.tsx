"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { Alert, Field } from "@/app/(auth)/parts";
import { LocationAutocomplete } from "@/app/components/LocationAutocomplete";
import {
  Avatar,
  Button,
  Checkbox,
  FormButton,
  ImageUploadField,
  SafeImg,
  TextLink,
  useToast,
} from "@/app/components/ui";
import { useLiveValidation } from "@/app/components/ui/useLiveValidation";
import { useSubmittedValues } from "@/app/components/ui/useSubmittedValues";
import { validateEmail, validatePassword } from "@/lib/validation";
import { safeExternalUrl, safeImageSrc } from "@/lib/url";
import {
  AGE_BRACKETS,
  COMPETITION_LEVELS,
  DISTANCE_PREFS,
  ORG_OPTIONAL_ROLES,
  ROLE_LABELS,
  TEAM_GENDERS,
  USER_GENDERS,
  type RoleValue,
} from "@/lib/enums";
import { Icon } from "../icons";
import {
  deleteMyAccount,
  updateEmail,
  updateNotificationPrefs,
  updatePassword,
  updateProfile,
  updateTeams,
  type AccountState,
} from "./actions";

type Tab = "profile" | "security" | "preferences" | "notifications";

const INITIAL: AccountState = {};

export type AccountProfile = {
  id: string;
  user_type: "attendee" | "event_director" | "admin";
  role_title: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  user_gender: string | null;
  organization_title: string | null;
  org_description: string | null;
  org_logo_url: string | null;
  profile_photo_url: string | null;
  business_phone: string | null;
  business_email: string | null;
  business_website: string | null;
  location_formatted: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_place_id: string | null;
  location_city: string | null;
  location_state_full: string | null;
  location_state_abbr: string | null;
  location_zip: string | null;
  distance_pref: string | null;
  email_review_replies: boolean;
  inapp_review_replies: boolean;
  email_review_likes: boolean;
  inapp_review_likes: boolean;
  email_comment_replies: boolean;
  inapp_comment_replies: boolean;
  email_event_reviews: boolean;
  inapp_event_reviews: boolean;
  email_favorited_events: boolean;
  inapp_favorited_events: boolean;
};

export type AccountTeam = {
  id: string;
  slot: number;
  team_gender: string | null;
  age: string | null;
  competition_level: string | null;
};


export function AccountClient({
  email,
  profile,
  teams,
  userType,
}: {
  email: string;
  profile: AccountProfile;
  teams: AccountTeam[];
  userType: "attendee" | "event_director" | "admin";
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const isAdmin = userType === "admin";
  const isEd = userType === "event_director";
  const showPrefs = !isAdmin;
  const showNotif = !isAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
          Account
        </h1>
      </div>
      <div className="flex gap-6 border-b border-slate-200" role="tablist">
        {(
          [
            { key: "profile", label: isAdmin ? "Profile" : userType === "attendee" ? "Personal Information" : "Profile" },
            { key: "security", label: "Security" },
            showPrefs ? { key: "preferences", label: "Preferences" } : null,
            showNotif ? { key: "notifications", label: "Notifications" } : null,
          ].filter(Boolean) as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`relative pb-3 text-[13.5px] font-semibold transition-colors ${
              tab === t.key
                ? "text-slate-900"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-red-600"
              />
            )}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <ProfileTab profile={profile} isEd={isEd} isAdmin={isAdmin} />
      )}
      {tab === "security" && (
        <SecurityTab email={email} canDelete={!isAdmin} />
      )}
      {tab === "preferences" && showPrefs && (
        <PreferencesTab profile={profile} teams={teams} />
      )}
      {tab === "notifications" && showNotif && (
        <NotificationsTab profile={profile} isEd={isEd} />
      )}
    </div>
  );
}

function ProfileTab({
  profile,
  isEd,
  isAdmin,
}: {
  profile: AccountProfile;
  isEd: boolean;
  isAdmin: boolean;
}) {
  const [state, formAction] = useActionState(updateProfile, INITIAL);
  const { values, capture } = useSubmittedValues();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    values.profile_photo_url ?? profile.profile_photo_url ?? "",
  );
  const [orgLogoUrl, setOrgLogoUrl] = useState(
    values.org_logo_url ?? profile.org_logo_url ?? "",
  );
  const { shownError: genderError, revalidate: revalidateGender } =
    useLiveValidation(state.fieldErrors?.user_gender, (value) =>
      USER_GENDERS.some((g) => g.value === value) ? null : "Invalid gender.",
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form
        action={(fd) => {
          capture(fd);
          formAction(fd);
        }}
        className="rounded-2xl border border-slate-200 bg-white"
      >
        <div className="divide-y divide-slate-100">
          {(state.error || state.info) && (
            <div className="space-y-3 p-6 md:px-7">
              {state.error && <Alert kind="error">{state.error}</Alert>}
              {state.info && <Alert kind="info">{state.info}</Alert>}
            </div>
          )}

          <FormSection
            title="Identity"
            description={
              isAdmin
                ? "Your name and photo across the admin tools."
                : isEd
                  ? "Your name and photo, shown alongside replies you post as a director."
                  : "Your name and photo, shown next to your reviews."
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="First name"
                name="first_name"
                placeholder="Your first name"
                defaultValue={values.first_name ?? profile.first_name ?? ""}
                required
                validate={(v) => (v.trim() ? null : "First name is required.")}
                error={state.fieldErrors?.first_name}
              />
              <Field
                label="Last name"
                name="last_name"
                placeholder="Your last name"
                defaultValue={values.last_name ?? profile.last_name ?? ""}
                required
                validate={(v) => (v.trim() ? null : "Last name is required.")}
                error={state.fieldErrors?.last_name}
              />
            </div>
            <ImageUploadField
              label="Profile photo"
              name="profile_photo_url"
              bucket="org-logos"
              value={profilePhotoUrl}
              onChange={setProfilePhotoUrl}
              hint="PNG or JPG, up to 5 MB — or paste a hosted URL."
            />
            {!isAdmin && (
              <>
                <LocationAutocomplete
                  label="Location"
                  name="location_formatted"
                  fieldPrefix="location"
                  placeholder="City or ZIP — start typing to search"
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
                />
                <fieldset>
                  <legend className="mb-2 text-[13px] font-semibold text-slate-800">
                    Gender
                  </legend>
                  <div className="flex gap-3">
                    {USER_GENDERS.map((g) => (
                      <label
                        key={g.value}
                        className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 has-[input:checked]:border-red-600 has-[input:checked]:bg-red-50 has-[input:checked]:text-red-700"
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
                {profile.dob && (
                  <p className="text-xs text-slate-500">
                    DOB on file: {profile.dob} (not displayed anywhere public).
                  </p>
                )}
              </>
            )}
          </FormSection>

          {!isEd && !isAdmin && (
            <FormSection
              title="Affiliation"
              description="Your club, shown next to your name on reviews."
            >
              <Field
                label="Club affiliation"
                name="organization_title"
                placeholder="Your club or team name"
                defaultValue={values.organization_title ?? profile.organization_title ?? ""}
                hint={
                  ORG_OPTIONAL_ROLES.has(profile.role_title)
                    ? "Optional for parents / spectators."
                    : undefined
                }
              />
            </FormSection>
          )}

          {isEd && (
            <FormSection
              title="Organization"
              description="How your organization appears on every event page you own."
            >
              <Field
                label="Organization title"
                name="organization_title"
                placeholder="Your organization name"
                defaultValue={values.organization_title ?? profile.organization_title ?? ""}
              />
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                  Organization description
                </span>
                <textarea
                  name="org_description"
                  rows={4}
                  placeholder="What attendees should know about your events…"
                  defaultValue={values.org_description ?? profile.org_description ?? ""}
                  className="tg-control resize-none"
                />
              </label>
              <ImageUploadField
                label="Organization logo"
                name="org_logo_url"
                bucket="org-logos"
                value={orgLogoUrl}
                onChange={setOrgLogoUrl}
                thumbSize="lg"
                hint="PNG or JPG, up to 5 MB — or paste a hosted URL."
              />
            </FormSection>
          )}

          {isEd && (
            <FormSection
              title="Public contact"
              description="Shown on your event pages — separate from your login email."
            >
              <Field
                label="Business phone"
                name="business_phone"
                type="tel"
                placeholder="(555) 000-0000"
                defaultValue={values.business_phone ?? profile.business_phone ?? ""}
                hint="Shown publicly on your event pages."
              />
              <Field
                label="Business email"
                name="business_email"
                type="email"
                placeholder="contact@yourorganization.com"
                defaultValue={values.business_email ?? profile.business_email ?? ""}
                hint="Public contact email — not your login email."
              />
              <Field
                label="Business website"
                name="business_website"
                type="url"
                placeholder="https://yourorganization.com"
                defaultValue={values.business_website ?? profile.business_website ?? ""}
              />
            </FormSection>
          )}
        </div>

        <div className="flex justify-end rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-4 md:px-7">
          <FormButton pendingLabel="Saving…">Save changes</FormButton>
        </div>
      </form>

      <ProfilePreviewCard profile={profile} isEd={isEd} isAdmin={isAdmin} />
    </div>
  );
}

/** Left label column + fields column, one per settings topic. */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-6 p-6 md:grid-cols-[180px_minmax(0,1fr)] md:gap-8 md:p-7">
      <div>
        <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-slate-900">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/**
 * Live summary of how the profile reads to others. Empty fields never
 * vanish — they render as "Add your …" placeholders that jump focus to
 * the matching input in the form.
 */
function ProfilePreviewCard({
  profile,
  isEd,
  isAdmin,
}: {
  profile: AccountProfile;
  isEd: boolean;
  isAdmin: boolean;
}) {
  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "Your name";
  const roleLabel = isAdmin
    ? "Admin"
    : ROLE_LABELS[profile.role_title as RoleValue] ?? profile.role_title;
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const location =
    profile.location_city && profile.location_state_abbr
      ? `${profile.location_city}, ${profile.location_state_abbr}`
      : profile.location_formatted;
  const website = safeExternalUrl(profile.business_website);

  const checklist: { noun: string; filled: boolean }[] = isAdmin
    ? []
    : [
        { noun: "a profile photo", filled: Boolean(profile.profile_photo_url) },
        { noun: "your location", filled: Boolean(profile.location_formatted) },
        ...(isEd
          ? [
              { noun: "your organization", filled: Boolean(profile.organization_title) },
              { noun: "an organization description", filled: Boolean(profile.org_description) },
              { noun: "an organization logo", filled: Boolean(profile.org_logo_url) },
              { noun: "a business phone", filled: Boolean(profile.business_phone) },
              { noun: "a business email", filled: Boolean(profile.business_email) },
              { noun: "your website", filled: Boolean(profile.business_website) },
            ]
          : [{ noun: "your club", filled: Boolean(profile.organization_title) }]),
      ];
  const done = checklist.filter((c) => c.filled).length;
  const pct = checklist.length
    ? Math.round((done / checklist.length) * 100)
    : 0;
  const missing = checklist.filter((c) => !c.filled).map((c) => c.noun);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-24">
      <div className="flex flex-col items-center text-center">
        <Avatar
          src={profile.profile_photo_url}
          name={fullName}
          size={72}
          className="text-[22px]"
        />
        <p className="mt-3.5 font-[var(--font-heading)] text-[17px] font-bold text-slate-900">
          {fullName}
        </p>
        <p className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-red-600">
          {roleLabel}
        </p>
      </div>
      <div className="my-5 h-px bg-slate-100" />
      <ul className="space-y-3 text-[13px] font-medium text-slate-600">
        {!isAdmin && (
          <li className="flex items-center gap-3">
            {profile.organization_title ? (
              <>
                <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-50 ring-1 ring-slate-200">
                  <SafeImg
                    src={safeImageSrc(profile.org_logo_url) ?? undefined}
                    alt=""
                    className="h-full w-full object-cover"
                    fallback={
                      <span className="font-[var(--font-heading)] text-[11px] font-extrabold text-slate-900">
                        {profile.organization_title.charAt(0).toUpperCase()}
                      </span>
                    }
                  />
                </span>
                <span className="min-w-0 truncate">
                  {profile.organization_title}
                </span>
              </>
            ) : (
              <>
                <Icon
                  name="users"
                  className="h-4 w-4 shrink-0 text-slate-400"
                />
                <AddFieldLink
                  noun={isEd ? "your organization" : "your club"}
                  field="organization_title"
                />
              </>
            )}
          </li>
        )}
        {!isAdmin && (
          <li className="flex items-center gap-3">
            <Icon name="pin" className="h-4 w-4 shrink-0 text-slate-400" />
            {location ?? (
              <AddFieldLink noun="your location" field="location_formatted" />
            )}
          </li>
        )}
        <li className="flex items-center gap-3">
          <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
          Member since {memberSince}
        </li>
        {isEd && (
          <li className="flex items-center gap-3">
            <Icon name="globe" className="h-4 w-4 shrink-0 text-slate-400" />
            {website ? (
              <TextLink
                href={website}
                className="min-w-0 truncate text-[13px]"
              >
                {website.replace(/^https?:\/\//, "")}
              </TextLink>
            ) : (
              <AddFieldLink noun="your website" field="business_website" />
            )}
          </li>
        )}
      </ul>
      {!isAdmin && (
        <>
          <div className="my-5 h-px bg-slate-100" />
          <div className="flex items-baseline justify-between">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              Completeness
            </p>
            <p className="font-[var(--font-heading)] text-[16px] font-extrabold text-slate-900">
              {pct}%
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-red-600"
              style={{ width: `${pct}%` }}
            />
          </div>
          {missing.length > 0 && (
            <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
              Add {missing.slice(0, 2).join(" and ")} to get to 100%.
            </p>
          )}
        </>
      )}
      {!isEd && !isAdmin && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-center">
          <TextLink href={`/attendees/${profile.id}`} className="text-[13px]">
            View public profile
          </TextLink>
        </div>
      )}
    </aside>
  );
}

/** Empty-field placeholder row — jumps focus to the matching form input. */
function AddFieldLink({ noun, field }: { noun: string; field: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.querySelector<HTMLElement>(`[name="${field}"]`);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        el?.focus({ preventScroll: true });
      }}
      className="font-semibold text-slate-400 underline decoration-dashed decoration-slate-300 underline-offset-[3px] transition-colors hover:text-red-600 hover:decoration-red-600"
    >
      Add {noun}
    </button>
  );
}

function SecurityTab({
  email,
  canDelete,
}: {
  email: string;
  canDelete: boolean;
}) {
  const [emailState, emailAction] = useActionState(updateEmail, INITIAL);
  const [pwState, pwAction] = useActionState(updatePassword, INITIAL);
  const { values: emailValues, capture: captureEmail } = useSubmittedValues();
  const { values: pwValues, capture: capturePw } = useSubmittedValues();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const { push } = useToast();

  return (
    <div className="max-w-xl space-y-6">
      <form
        action={(fd) => {
          captureEmail(fd);
          emailAction(fd);
        }}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          Update email
        </h3>
        {emailState.error && <Alert kind="error">{emailState.error}</Alert>}
        {emailState.info && <Alert kind="info">{emailState.info}</Alert>}
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={emailValues.email ?? email}
          validate={validateEmail}
          error={emailState.fieldErrors?.email}
        />
        <FormButton pendingLabel="Sending…">Send confirmation link</FormButton>
      </form>

      <form
        action={(fd) => {
          capturePw(fd);
          pwAction(fd);
        }}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
          Change password
        </h3>
        {pwState.error && <Alert kind="error">{pwState.error}</Alert>}
        {pwState.info && <Alert kind="info">{pwState.info}</Alert>}
        <Field
          label="New password"
          name="password"
          type="password"
          defaultValue={pwValues.password ?? ""}
          validate={validatePassword}
          error={pwState.fieldErrors?.password}
        />
        <FormButton pendingLabel="Updating…">Update password</FormButton>
      </form>

      {canDelete && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-red-900">
            Delete account
          </h3>
          <p className="mt-2 text-sm text-red-800">
            Your reviews and comments become anonymous but stay
            available. Events you own get returned to the admin for
            re-claim.
          </p>
          <div className="mt-3">
            <Button
              variant="danger"
              onClick={() => {
                setDeletePassword("");
                setDeleteError(undefined);
                setConfirmDelete(true);
              }}
            >
              Delete my account
            </Button>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deletePending) {
              setConfirmDelete(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
              Delete your account?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This action is permanent. Reviews + comments stay under
              &quot;Former member&quot;; owned tournaments + created events get
              removed; claimed-only events revert to the admin.
            </p>
            <p className="mt-4 text-sm text-slate-700">
              Enter your current password to confirm.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeleteError(undefined);
              }}
              className="tg-control mt-2"
              aria-invalid={deleteError ? true : undefined}
              disabled={deletePending}
            />
            {deleteError && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deletePending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deletePending || !deletePassword}
                onClick={async () => {
                  setDeletePending(true);
                  const res = await deleteMyAccount(deletePassword);
                  setDeletePending(false);
                  if (res.fieldErrors?.password) {
                    setDeleteError(res.fieldErrors.password);
                    return;
                  }
                  if (res.error) {
                    push("error", res.error);
                    return;
                  }
                  // success → server redirected; nothing to do.
                }}
              >
                {deletePending ? "Deleting…" : "Delete account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreferencesTab({
  profile,
  teams,
}: {
  profile: AccountProfile;
  teams: AccountTeam[];
}) {
  const [state, formAction] = useActionState(updateTeams, INITIAL);
  const { values, capture } = useSubmittedValues();
  const { shownError: distanceError, revalidate: revalidateDistance } =
    useLiveValidation(state.fieldErrors?.distance_pref, (value) =>
      DISTANCE_PREFS.some((d) => d.value === value)
        ? null
        : "Invalid distance option.",
    );
  const [localTeams, setLocalTeams] = useState<AccountTeam[]>(() => {
    const maxSlots = profile.role_title === "parent_spectator" ? 1 : 3;
    const list: AccountTeam[] = [];
    for (let i = 1; i <= maxSlots; i++) {
      const existing = teams.find((t) => t.slot === i);
      list.push(
        existing ?? {
          id: `slot-${i}`,
          slot: i,
          team_gender: null,
          age: null,
          competition_level: null,
        },
      );
    }
    return list;
  });
  return (
    <form
      action={(fd) => {
        capture(fd);
        formAction(fd);
      }}
      className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.info && <Alert kind="info">{state.info}</Alert>}
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-slate-800">
          Distance preference
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DISTANCE_PREFS.map((d) => (
            <label
              key={d.value}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-center text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 has-[input:checked]:border-red-600 has-[input:checked]:bg-red-50 has-[input:checked]:text-red-700"
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
                onChange={(e) => revalidateDistance(e.currentTarget)}
                className="sr-only"
              />
              {d.label}
            </label>
          ))}
        </div>
        {distanceError && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {distanceError}
          </p>
        )}
      </fieldset>
      <div className="space-y-3">
        {localTeams.map((t, i) => (
          <TeamSlot
            key={t.slot}
            slot={t.slot}
            team={t}
            values={values}
            onChange={(next) => {
              const copy = [...localTeams];
              copy[i] = { ...t, ...next };
              setLocalTeams(copy);
            }}
          />
        ))}
      </div>
      <FormButton pendingLabel="Saving…">Save preferences</FormButton>
    </form>
  );
}

function TeamSlot({
  slot,
  team,
  values,
  onChange,
}: {
  slot: number;
  team: AccountTeam;
  values: Record<string, string>;
  onChange: (next: Partial<AccountTeam>) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        Team {slot}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label>
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Gender
          </span>
          {/* key: select defaultValue applies only at mount — remount on the
              captured value so a failed submit keeps the chosen option. */}
          <select
            name={`team_${slot}_gender`}
            key={values[`team_${slot}_gender`] ?? "unset"}
            defaultValue={values[`team_${slot}_gender`] ?? team.team_gender ?? ""}
            onChange={(e) => onChange({ team_gender: e.target.value || null })}
            className="tg-control tg-select"
          >
            <option value="">—</option>
            {TEAM_GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Age
          </span>
          <select
            name={`team_${slot}_age`}
            key={values[`team_${slot}_age`] ?? "unset"}
            defaultValue={values[`team_${slot}_age`] ?? team.age ?? ""}
            onChange={(e) => onChange({ age: e.target.value || null })}
            className="tg-control tg-select"
          >
            <option value="">—</option>
            {AGE_BRACKETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-slate-700">
            Level
          </span>
          <select
            name={`team_${slot}_level`}
            key={values[`team_${slot}_level`] ?? "unset"}
            defaultValue={values[`team_${slot}_level`] ?? team.competition_level ?? ""}
            onChange={(e) => onChange({ competition_level: e.target.value || null })}
            className="tg-control tg-select"
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

function NotificationsTab({
  profile,
  isEd,
}: {
  profile: AccountProfile;
  isEd: boolean;
}) {
  const [state, formAction] = useActionState(updateNotificationPrefs, INITIAL);
  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.info && <Alert kind="info">{state.info}</Alert>}
      <h3 className="font-[var(--font-heading)] text-lg font-extrabold text-slate-900">
        Notifications
      </h3>
      <NotifRow
        section="review_replies"
        title="Review replies"
        subtitle="Replies you receive on your published event reviews."
        defaults={{
          inapp: profile.inapp_review_replies,
          email: profile.email_review_replies,
        }}
        namePair={["inapp_review_replies", "email_review_replies"]}
      />
      <NotifRow
        section="review_likes"
        title="Review likes"
        subtitle="Likes you receive on your published event reviews."
        defaults={{
          inapp: profile.inapp_review_likes,
          email: profile.email_review_likes,
        }}
        namePair={["inapp_review_likes", "email_review_likes"]}
      />
      <NotifRow
        section="comment_replies"
        title="Comment replies"
        subtitle="Replies you receive on your published event comments."
        defaults={{
          inapp: profile.inapp_comment_replies,
          email: profile.email_comment_replies,
        }}
        namePair={["inapp_comment_replies", "email_comment_replies"]}
      />
      {isEd && (
        <>
          <NotifRow
            section="event_reviews"
            title="Event reviews"
            subtitle="New reviews on your published events."
            defaults={{
              inapp: profile.inapp_event_reviews,
              email: profile.email_event_reviews,
            }}
            namePair={["inapp_event_reviews", "email_event_reviews"]}
          />
          <NotifRow
            section="favorited_events"
            title="Favorited events"
            subtitle="When your events are favorited."
            defaults={{
              inapp: profile.inapp_favorited_events,
              email: profile.email_favorited_events,
            }}
            namePair={["inapp_favorited_events", "email_favorited_events"]}
          />
        </>
      )}
      <FormButton pendingLabel="Saving…">Save</FormButton>
    </form>
  );
}

function NotifRow({
  section,
  title,
  subtitle,
  defaults,
  namePair,
}: {
  section: string;
  title: string;
  subtitle: string;
  defaults: { inapp: boolean; email: boolean };
  namePair: [string, string];
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <p className="text-[13px] font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Checkbox
          size="sm"
          name={namePair[0]}
          defaultChecked={defaults.inapp}
          label="In-app"
        />
        <Checkbox
          size="sm"
          name={namePair[1]}
          defaultChecked={defaults.email}
          label="Email"
        />
      </div>
      <input type="hidden" name={`section:${section}`} value="1" />
    </div>
  );
}
