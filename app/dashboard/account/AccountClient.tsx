"use client";

import { useActionState, useState } from "react";
import { Alert, Field } from "@/app/(auth)/parts";
import {
  Button,
  ConfirmDialog,
  useToast,
} from "@/app/components/ui";
import {
  AGE_BRACKETS,
  COMPETITION_LEVELS,
  DISTANCE_PREFS,
  ORG_OPTIONAL_ROLES,
  TEAM_GENDERS,
  USER_GENDERS,
} from "@/lib/enums";
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
  user_type: "attendee" | "event_director" | "admin";
  role_title: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  user_gender: string | null;
  organization_title: string | null;
  org_description: string | null;
  org_logo_url: string | null;
  profile_photo_url: string | null;
  location_formatted: string | null;
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

type Profile = AccountProfile;
type Team = AccountTeam;

export function AccountClient({
  email,
  profile,
  teams,
  userType,
}: {
  email: string;
  profile: Profile;
  teams: Team[];
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
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Account
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
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
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {t.label}
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
  profile: Profile;
  isEd: boolean;
  isAdmin: boolean;
}) {
  const [state, formAction] = useActionState(updateProfile, INITIAL);
  const orgLabel = isEd
    ? "Organization title"
    : "Club affiliation";
  return (
    <form action={formAction} className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.info && <Alert kind="info">{state.info}</Alert>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="First name"
          name="first_name"
          defaultValue={profile.first_name ?? ""}
          required
          error={state.fieldErrors?.first_name}
        />
        <Field
          label="Last name"
          name="last_name"
          defaultValue={profile.last_name ?? ""}
          required
          error={state.fieldErrors?.last_name}
        />
      </div>
      <Field
        label="Profile photo URL"
        name="profile_photo_url"
        type="url"
        defaultValue={profile.profile_photo_url ?? ""}
        hint="Upload flow ships in a follow-up."
      />
      {!isAdmin && (
        <>
          <Field
            label="Location"
            name="location_formatted"
            defaultValue={profile.location_formatted ?? ""}
          />
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-slate-800">
              Gender
            </legend>
            <div className="flex gap-3">
              {USER_GENDERS.map((g) => (
                <label
                  key={g.value}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 has-[input:checked]:border-slate-900 has-[input:checked]:bg-slate-900 has-[input:checked]:text-white"
                >
                  <input
                    type="radio"
                    name="user_gender"
                    value={g.value}
                    defaultChecked={profile.user_gender === g.value}
                    className="sr-only"
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </fieldset>
          {profile.dob && (
            <p className="text-xs text-slate-500">
              DOB on file: {profile.dob} (not displayed anywhere public).
            </p>
          )}
          <Field
            label={orgLabel}
            name="organization_title"
            defaultValue={profile.organization_title ?? ""}
            hint={
              ORG_OPTIONAL_ROLES.has(profile.role_title)
                ? "Optional for parents / spectators."
                : undefined
            }
          />
        </>
      )}
      {isEd && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-800">
              Organization description
            </span>
            <textarea
              name="org_description"
              rows={4}
              defaultValue={profile.org_description ?? ""}
              className="tg-control resize-none"
            />
          </label>
          <Field
            label="Organization logo URL"
            name="org_logo_url"
            type="url"
            defaultValue={profile.org_logo_url ?? ""}
          />
        </>
      )}
      <Button type="submit">Save changes</Button>
    </form>
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { push } = useToast();

  return (
    <div className="max-w-xl space-y-6">
      <form
        action={emailAction}
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
          defaultValue={email}
          error={emailState.fieldErrors?.email}
        />
        <Button type="submit">Send confirmation link</Button>
      </form>

      <form
        action={pwAction}
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
          error={pwState.fieldErrors?.password}
        />
        <Button type="submit">Update password</Button>
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
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        body="This action is permanent. Reviews + comments stay under 'Former member'; owned tournaments + created events get removed; claimed-only events revert to the admin."
        confirmLabel="Delete account"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteMyAccount();
          if (res.error) push("error", res.error);
        }}
      />
    </div>
  );
}

function PreferencesTab({
  profile,
  teams,
}: {
  profile: Profile;
  teams: Team[];
}) {
  const [state, formAction] = useActionState(updateTeams, INITIAL);
  const [localTeams, setLocalTeams] = useState<Team[]>(() => {
    const maxSlots = profile.role_title === "parent_spectator" ? 1 : 3;
    const list: Team[] = [];
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
    <form action={formAction} className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
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
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-center text-sm font-semibold text-slate-800 has-[input:checked]:border-slate-900 has-[input:checked]:bg-slate-900 has-[input:checked]:text-white"
            >
              <input
                type="radio"
                name="distance_pref"
                value={d.value}
                defaultChecked={profile.distance_pref === d.value}
                className="sr-only"
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-3">
        {localTeams.map((t, i) => (
          <TeamSlot
            key={t.slot}
            slot={t.slot}
            team={t}
            onChange={(next) => {
              const copy = [...localTeams];
              copy[i] = { ...t, ...next };
              setLocalTeams(copy);
            }}
          />
        ))}
      </div>
      <Button type="submit">Save preferences</Button>
    </form>
  );
}

function TeamSlot({
  slot,
  team,
  onChange,
}: {
  slot: number;
  team: Team;
  onChange: (next: Partial<Team>) => void;
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
          <select
            name={`team_${slot}_gender`}
            defaultValue={team.team_gender ?? ""}
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
            defaultValue={team.age ?? ""}
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
            defaultValue={team.competition_level ?? ""}
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
  profile: Profile;
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
      <Button type="submit">Save</Button>
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
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <input
            type="checkbox"
            name={namePair[0]}
            defaultChecked={defaults.inapp}
          />
          In-app
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <input
            type="checkbox"
            name={namePair[1]}
            defaultChecked={defaults.email}
          />
          Email
        </label>
      </div>
      <input type="hidden" name={`section:${section}`} value="1" />
    </div>
  );
}
