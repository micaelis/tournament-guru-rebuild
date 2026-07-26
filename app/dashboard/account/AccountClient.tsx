"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { Alert, Field, PasswordField } from "@/app/(auth)/parts";
import { LocationAutocomplete } from "@/app/components/LocationAutocomplete";
import {
  Avatar,
  Button,
  FormButton,
  ImageUploadField,
  SafeImg,
  Switch,
  TextLink,
  useToast,
} from "@/app/components/ui";
import { usFromIso } from "@/app/components/ui/USDateInput";
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
import type { NotifField } from "./notif-fields";

type Tab = "profile" | "security" | "preferences" | "notifications";

const INITIAL: AccountState = {};

/** Fires the global toast when a save action reports success. Depends on
 * the state OBJECT — useActionState returns a fresh one per completed
 * action — so back-to-back saves with identical messages still re-fire. */
function useSaveToast(state: AccountState) {
  const { push } = useToast();
  useEffect(() => {
    if (state.info) push("success", state.info);
  }, [state, push]);
}

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
  emailVerified,
  profile,
  teams,
  userType,
}: {
  email: string;
  emailVerified: boolean;
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
        <p className="mt-1 text-[13.5px] text-slate-500">
          Your profile, sign-in details, and how Tournament Guru reaches you.
        </p>
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
        <SecurityTab
          email={email}
          emailVerified={emailVerified}
          canDelete={!isAdmin}
          isEd={isEd}
        />
      )}
      {tab === "preferences" && showPrefs && (
        <PreferencesTab profile={profile} teams={teams} />
      )}
      {tab === "notifications" && showNotif && (
        <NotificationsTab profile={profile} isEd={isEd} email={email} />
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
  useSaveToast(state);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {state.error && <Alert kind="error">{state.error}</Alert>}

        <form
          action={(fd) => {
            capture(fd);
            formAction(fd);
          }}
          className="rounded-2xl border border-slate-200 bg-white"
        >
          <div className="divide-y divide-slate-100">
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
              <ImageUploadField
                label="Profile photo"
                name="profile_photo_url"
                bucket="org-logos"
                value={profilePhotoUrl}
                onChange={setProfilePhotoUrl}
                thumbShape="circle"
                hint="PNG or JPG, up to 5 MB — shown as a circle everywhere it appears."
              />
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
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                        Date of birth
                      </span>
                      <span className="relative block">
                        <input
                          className="tg-control pr-11 read-only:bg-slate-50 read-only:text-slate-700 focus:border-[var(--color-border)] focus:shadow-none"
                          value={usFromIso(profile.dob) || profile.dob}
                          readOnly
                        />
                        <Icon
                          name="lock"
                          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        />
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Used at signup to confirm you&apos;re 18+. Never shown
                        publicly.
                      </span>
                    </label>
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
                description="Shown on your event pages so coaches and parents can reach you — kept separate from the email you sign in with."
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
      </div>

      <ProfilePreviewCard profile={profile} isEd={isEd} isAdmin={isAdmin} />
    </div>
  );
}

/** Left label column + fields column, one per settings topic. The label
 * column is fixed-width so titles and descriptions wrap cleanly beneath
 * each other; both columns take min-w-0 so long content never squeezes
 * the header sideways (collapses to stacked below md). */
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
    <div className="grid gap-6 p-6 md:grid-cols-[210px_minmax(0,1fr)] md:gap-8 md:p-7">
      <div className="min-w-0">
        <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-slate-900">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
}

/**
 * Live summary of how the profile reads to others. Empty fields never
 * vanish — they render as "Add your …" placeholders that jump focus to
 * the matching input in the form. At 100% the meter disappears in favor
 * of a quiet "profile complete" note with a next-step link (S12.9 #3).
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
  const completeCopy = isEd
    ? "Everything's filled in — attendees see the full picture. Put it to work with your next listing."
    : "Everything's filled in — your reviews now carry your full profile.";

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
          {pct === 100 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
                  <Icon
                    name="check"
                    className="h-2.5 w-2.5 text-emerald-600"
                  />
                </span>
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                  Profile complete
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {completeCopy}
              </p>
              <TextLink
                href={isEd ? "/dashboard/events/new" : "/events"}
                className="mt-2 inline-block text-[12.5px]"
              >
                {isEd ? "Add an event →" : "Find your next event →"}
              </TextLink>
            </div>
          ) : (
            <>
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
  emailVerified,
  canDelete,
  isEd,
}: {
  email: string;
  emailVerified: boolean;
  canDelete: boolean;
  isEd: boolean;
}) {
  const [emailState, emailAction] = useActionState(updateEmail, INITIAL);
  const [pwState, pwAction] = useActionState(updatePassword, INITIAL);
  const { values: emailValues, capture: captureEmail } = useSubmittedValues();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const { push } = useToast();

  // #6 — this copy states what delete_ed_account / soft_delete_attendee
  // actually do (S11.9 true-delete): content is removed, not anonymized.
  const deleteSummary = isEd
    ? "Permanently deletes your reviews and comments. Events and tournaments you created are removed; listings you only claimed return to Tournament Guru for re-claim. This can't be undone."
    : "Permanently deletes your reviews and comments. This can't be undone.";
  const deleteDialogBody = isEd
    ? "This is permanent. Your reviews and comments are deleted for good; events and tournaments you created are removed, and listings you only claimed return to Tournament Guru for re-claim."
    : "This is permanent. Your reviews and comments are deleted for good.";

  // Password success rides the toast; the email flow keeps its inline
  // Alert — it's a stays-on-screen instruction (check both inboxes), not
  // a completed save.
  useSaveToast(pwState);
  const anyAlert = emailState.error || emailState.info || pwState.error;

  return (
    <div className="max-w-2xl space-y-4">
      {anyAlert && (
        <div className="space-y-3">
          {emailState.error && <Alert kind="error">{emailState.error}</Alert>}
          {emailState.info && <Alert kind="info">{emailState.info}</Alert>}
          {pwState.error && <Alert kind="error">{pwState.error}</Alert>}
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        <form
          action={(fd) => {
            captureEmail(fd);
            emailAction(fd);
          }}
        >
          <FormSection
            title="Login email"
            description="The address you sign in with. Confirmation links and account notices go here."
          >
            <Field
              label="Email"
              name="email"
              type="email"
              defaultValue={emailValues.email ?? email}
              validate={validateEmail}
              error={emailState.fieldErrors?.email}
              hint="Changing it emails a confirmation link to both addresses — the switch happens once confirmed."
              labelAccessory={
                emailVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-700 ring-1 ring-emerald-200">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                    />
                    Verified
                  </span>
                ) : undefined
              }
            />
            <div className="flex justify-end">
              <FormButton variant="ghost" pendingLabel="Sending…">
                Send confirmation link
              </FormButton>
            </div>
          </FormSection>
        </form>

        <form action={pwAction}>
          <FormSection
            title="Password"
            description="Protects your account. You'll stay signed in on this device after a change."
          >
            <div>
              <PasswordField
                label="New password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                validate={validatePassword}
                error={pwState.fieldErrors?.password}
              />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {["8+ characters", "1 uppercase", "1 number"].map((rule) => (
                  <span
                    key={rule}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                  >
                    {rule}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <FormButton pendingLabel="Updating…">Update password</FormButton>
            </div>
          </FormSection>
        </form>
      </div>

      {canDelete && (
        <div className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-white p-6 sm:flex-row sm:items-center md:p-7">
          <div className="min-w-0 flex-1">
            <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-red-700">
              Delete account
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
              {deleteSummary}
            </p>
          </div>
          <Button
            variant="danger"
            className="flex-none"
            onClick={() => {
              setDeletePassword("");
              setDeleteError(undefined);
              setConfirmDelete(true);
            }}
          >
            Delete my account
          </Button>
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
            <p className="mt-2 text-sm text-slate-600">{deleteDialogBody}</p>
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
  const maxSlots = profile.role_title === "parent_spectator" ? 1 : 3;
  // Controlled team fields: chips + selects read from this state, so a
  // save (or a failed submit) never resets what's on screen.
  const [localTeams, setLocalTeams] = useState<AccountTeam[]>(() => {
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
  // Slot 1 is always editable; later slots start collapsed into an
  // "Add a … team" affordance until they hold data or get opened.
  const [openSlots, setOpenSlots] = useState<Set<number>>(() => {
    const open = new Set<number>([1]);
    for (const t of localTeams) {
      if (t.team_gender || t.age || t.competition_level) open.add(t.slot);
    }
    return open;
  });

  const updateSlot = (index: number, patch: Partial<AccountTeam>) => {
    setLocalTeams((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  };
  const clearSlot = (index: number, slot: number) => {
    updateSlot(index, { team_gender: null, age: null, competition_level: null });
    if (slot > 1) {
      setOpenSlots((prev) => {
        const next = new Set(prev);
        next.delete(slot);
        return next;
      });
    }
  };
  useSaveToast(state);

  return (
    <div className="max-w-3xl space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}

      <form
        action={(fd) => {
          capture(fd);
          formAction(fd);
        }}
        className="rounded-2xl border border-slate-200 bg-white"
      >
        <div className="divide-y divide-slate-100">
          <FormSection
            title="Travel distance"
            description="How far you'd go for the right event. We use it to rank search results near you."
          >
            <fieldset>
              <legend className="sr-only">Distance preference</legend>
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
          </FormSection>

          <FormSection
            title="Your teams"
            description={
              maxSlots === 1
                ? "Your team's age group and level tailor search filters and recommendations."
                : "Up to three teams. Search filters and recommendations start from these age groups and levels."
            }
          >
            {localTeams.map((t, i) =>
              openSlots.has(t.slot) ? (
                <TeamSlotCard
                  key={t.slot}
                  team={t}
                  onChange={(patch) => updateSlot(i, patch)}
                  onClear={() => clearSlot(i, t.slot)}
                />
              ) : (
                <button
                  key={t.slot}
                  type="button"
                  onClick={() =>
                    setOpenSlots((prev) => new Set(prev).add(t.slot))
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-[13px] font-semibold text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
                >
                  + Add a {t.slot === 2 ? "second" : "third"} team
                </button>
              ),
            )}
          </FormSection>
        </div>
        <div className="flex justify-end rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-4 md:px-7">
          <FormButton pendingLabel="Saving…">Save preferences</FormButton>
        </div>
      </form>
    </div>
  );
}

/** One editable team: Age stays a dropdown (the style guide's single
 * allowed select); gender + level are choice chips. Fully controlled so
 * Clear/Remove and post-save renders stay truthful. */
function TeamSlotCard({
  team,
  onChange,
  onClear,
}: {
  team: AccountTeam;
  onChange: (patch: Partial<AccountTeam>) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
          Team {team.slot}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-[11.5px] font-semibold text-slate-400 transition-colors hover:text-red-600"
        >
          {team.slot === 1 ? "Clear" : "Remove"}
        </button>
      </div>
      <div className="mt-3.5 grid gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Age group
          </span>
          <select
            name={`team_${team.slot}_age`}
            value={team.age ?? ""}
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
        <fieldset className="min-w-0">
          <legend className="mb-1.5 block text-xs font-semibold text-slate-700">
            Gender
          </legend>
          <div className="flex flex-wrap gap-2">
            {TEAM_GENDERS.map((g) => (
              <ChipRadio
                key={g.value}
                name={`team_${team.slot}_gender`}
                value={g.value}
                label={g.label}
                checked={team.team_gender === g.value}
                onChange={() => onChange({ team_gender: g.value })}
              />
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-1.5 block text-xs font-semibold text-slate-700">
          Competition level
        </legend>
        <div className="flex flex-wrap gap-2">
          {COMPETITION_LEVELS.map((c) => (
            <ChipRadio
              key={c.value}
              name={`team_${team.slot}_level`}
              value={c.value}
              label={c.label}
              checked={team.competition_level === c.value}
              onChange={() => onChange({ competition_level: c.value })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Choice chip backed by a radio — checked = soft red tint (S12.3). */
function ChipRadio({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-800 transition-colors hover:border-slate-400 has-[input:checked]:border-red-600 has-[input:checked]:bg-red-50 has-[input:checked]:text-red-700">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}

const NOTIF_ROWS: {
  section: string;
  title: string;
  subtitle: string;
  inapp: NotifField;
  email: NotifField;
  edOnly?: boolean;
}[] = [
  {
    section: "review_replies",
    title: "Review replies",
    subtitle: "Someone replies to one of your published reviews.",
    inapp: "inapp_review_replies",
    email: "email_review_replies",
  },
  {
    section: "review_likes",
    title: "Review likes",
    subtitle: "Someone likes one of your published reviews.",
    inapp: "inapp_review_likes",
    email: "email_review_likes",
  },
  {
    section: "comment_replies",
    title: "Comment replies",
    subtitle: "Someone replies to one of your event comments.",
    inapp: "inapp_comment_replies",
    email: "email_comment_replies",
  },
  {
    section: "event_reviews",
    title: "Event reviews",
    subtitle: "A new review is published on one of your events.",
    inapp: "inapp_event_reviews",
    email: "email_event_reviews",
    edOnly: true,
  },
  {
    section: "favorited_events",
    title: "Favorited events",
    subtitle: "Someone favorites one of your events.",
    inapp: "inapp_favorited_events",
    email: "email_favorited_events",
    edOnly: true,
  },
];

function NotificationsTab({
  profile,
  isEd,
  email,
}: {
  profile: AccountProfile;
  isEd: boolean;
  email: string;
}) {
  const [state, formAction] = useActionState(updateNotificationPrefs, INITIAL);
  // #2 fix (S12.10): CONTROLLED switches. React resets uncontrolled form
  // fields to their defaults after a server action, and the defaults come
  // from the page-load profile prop — so a saved "off" used to snap back
  // to "on". Controlled state survives the reset and, being what was just
  // submitted, always shows the saved values.
  const [prefs, setPrefs] = useState<Record<NotifField, boolean>>(() => ({
    email_review_replies: profile.email_review_replies,
    inapp_review_replies: profile.inapp_review_replies,
    email_review_likes: profile.email_review_likes,
    inapp_review_likes: profile.inapp_review_likes,
    email_comment_replies: profile.email_comment_replies,
    inapp_comment_replies: profile.inapp_comment_replies,
    email_event_reviews: profile.email_event_reviews,
    inapp_event_reviews: profile.inapp_event_reviews,
    email_favorited_events: profile.email_favorited_events,
    inapp_favorited_events: profile.inapp_favorited_events,
  }));
  const toggle = (field: NotifField, checked: boolean) =>
    setPrefs((prev) => ({ ...prev, [field]: checked }));

  const activityRows = NOTIF_ROWS.filter((r) => !r.edOnly);
  const eventRows = isEd ? NOTIF_ROWS.filter((r) => r.edOnly) : [];
  useSaveToast(state);

  return (
    <div className="max-w-3xl space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}

      <form
        action={formAction}
        className="rounded-2xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-100 p-6 md:px-7">
          <h3 className="font-[var(--font-heading)] text-[17px] font-bold text-slate-900">
            Notifications
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
            Choose where each alert reaches you. In-app shows in your
            dashboard; email goes to{" "}
            <span className="font-semibold text-slate-700">{email}</span>.
          </p>
        </div>

        <div className="px-6 pb-2 md:px-7">
          <NotifGroupHeader label="Your activity" withColumns />
          <div className="divide-y divide-slate-100">
            {activityRows.map((row) => (
              <NotifRow
                key={row.section}
                row={row}
                values={prefs}
                onToggle={toggle}
              />
            ))}
          </div>
          {eventRows.length > 0 && (
            <>
              <NotifGroupHeader label="Your events" />
              <div className="divide-y divide-slate-100">
                {eventRows.map((row) => (
                  <NotifRow
                    key={row.section}
                    row={row}
                    values={prefs}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-4 md:px-7">
          <FormButton pendingLabel="Saving…">Save</FormButton>
        </div>
      </form>
    </div>
  );
}

function NotifGroupHeader({
  label,
  withColumns,
}: {
  label: string;
  withColumns?: boolean;
}) {
  const colClass =
    "w-14 text-center text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400";
  return (
    <div className="flex items-center gap-4 pb-2 pt-6">
      <p className="min-w-0 flex-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      {withColumns ? (
        <>
          <p className={colClass}>In-app</p>
          <p className={colClass}>Email</p>
        </>
      ) : (
        <>
          <span className="w-14" />
          <span className="w-14" />
        </>
      )}
    </div>
  );
}

function NotifRow({
  row,
  values,
  onToggle,
}: {
  row: (typeof NOTIF_ROWS)[number];
  values: Record<NotifField, boolean>;
  onToggle: (field: NotifField, checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-slate-800">{row.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {row.subtitle}
        </p>
      </div>
      <div className="grid w-14 place-items-center">
        <Switch
          name={row.inapp}
          checked={values[row.inapp]}
          onChange={(checked) => onToggle(row.inapp, checked)}
          aria-label={`${row.title} (in-app)`}
        />
      </div>
      <div className="grid w-14 place-items-center">
        <Switch
          name={row.email}
          checked={values[row.email]}
          onChange={(checked) => onToggle(row.email, checked)}
          aria-label={`${row.title} (email)`}
        />
      </div>
      <input type="hidden" name={`section:${row.section}`} value="1" />
    </div>
  );
}
