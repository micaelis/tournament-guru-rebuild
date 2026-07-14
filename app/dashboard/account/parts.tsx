"use client";

/* AccountEditor — the /dashboard/account form. Mirrors the intent of the
   Bubble `account A` reusable: profile identity, org info, notification
   prefs, plus read-only stats + role identifier. Uses a single server
   action (updateAccount) so a save touches every field at once. */

import { useActionState, useState } from "react";
import { updateAccount, type AccountUpdateState } from "./actions";

type Fields = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  contact_email: string | null;
  club_affiliation: string | null;
  org_description: string | null;
  org_logo: string | null;
  location_text: string | null;
  user_type: "admin" | "event_director" | "attendee" | "company";
  attendee_type: string | null;
  total_events: number | null;
  total_reviews: number | null;
  email_fav_events: boolean | null;
  inapp_fav_events: boolean | null;
  email_review_likes: boolean | null;
  inapp_review_likes: boolean | null;
  email_event_reviews: boolean | null;
  inapp_event_reviews: boolean | null;
  email_review_comments: boolean | null;
  inapp_review_comments: boolean | null;
  email_comment_replies: boolean | null;
  inapp_comment_replies: boolean | null;
};

const ROLE_LABEL: Record<Fields["user_type"], string> = {
  admin: "Administrator",
  event_director: "Event Director",
  attendee: "Attendee",
  company: "Company",
};

const ATTENDEE_TYPE_LABEL: Record<string, string> = {
  coach: "Coach",
  parent_spectator: "Parent / Spectator",
  team_manager: "Team Manager",
};

/** Notification pref rows. Each row is one topic (favorites, review likes,
 *  comments, etc.) with a checkbox for the email + in-app channels. */
const NOTIF_ROWS: {
  label: string;
  detail: string;
  emailKey: keyof Fields;
  inappKey: keyof Fields;
}[] = [
  {
    label: "Favorite events",
    detail: "Updates to events you've saved.",
    emailKey: "email_fav_events",
    inappKey: "inapp_fav_events",
  },
  {
    label: "Review likes",
    detail: "When someone likes a review you wrote.",
    emailKey: "email_review_likes",
    inappKey: "inapp_review_likes",
  },
  {
    label: "Event reviews",
    detail: "New reviews on events you host (Event Directors).",
    emailKey: "email_event_reviews",
    inappKey: "inapp_event_reviews",
  },
  {
    label: "Review comments",
    detail: "When someone comments on your review.",
    emailKey: "email_review_comments",
    inappKey: "inapp_review_comments",
  },
  {
    label: "Comment replies",
    detail: "When someone replies to a comment thread you're in.",
    emailKey: "email_comment_replies",
    inappKey: "inapp_comment_replies",
  },
];

export function AccountEditor({ fields }: { fields: Fields }) {
  const [state, formAction, pending] = useActionState<
    AccountUpdateState,
    FormData
  >(updateAccount, {});

  const isEd = fields.user_type === "event_director";
  const isAdmin = fields.user_type === "admin";
  const showOrgSection = isEd || isAdmin || !!fields.club_affiliation;

  return (
    <div>
      {/* Header */}
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full"
            style={{ width: 6, height: 6, background: "var(--color-accent)" }}
          />
          <span
            className="font-heading uppercase"
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".14em",
              color: "var(--color-text-secondary)",
            }}
          >
            Your account
          </span>
        </div>
        <h1
          className="font-heading"
          style={{
            fontSize: "clamp(24px, 3vw, 30px)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--color-dark)",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Account settings
        </h1>
        <p
          className="mt-2 max-w-2xl"
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--color-text-secondary)",
          }}
        >
          Update your profile, {isEd || isAdmin ? "organization info," : ""}{" "}
          and how Tournament Guru reaches out to you.
        </p>
      </header>

      <form action={formAction} className="flex flex-col gap-5">
        {/* Save banner */}
        {state.error && (
          <StatusBanner tone="error">{state.error}</StatusBanner>
        )}
        {state.ok && !pending && (
          <StatusBanner tone="ok">Saved.</StatusBanner>
        )}

        {/* ── Identity ─────────────────────────────────────────────── */}
        <Card
          title="Identity"
          detail="Your name and the email we deliver notifications to."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input
                name="first_name"
                defaultValue={fields.first_name ?? ""}
                className="tg-control"
                placeholder="Enter first name"
                autoComplete="given-name"
              />
            </Field>
            <Field label="Last name">
              <input
                name="last_name"
                defaultValue={fields.last_name ?? ""}
                className="tg-control"
                placeholder="Enter last name"
                autoComplete="family-name"
              />
            </Field>
          </div>
          <Field
            label="Email"
            hint="Changing your login email is handled from Auth Settings; contact support if you need to move it."
          >
            <input
              className="tg-control"
              defaultValue={fields.contact_email ?? ""}
              disabled
              style={{
                background: "var(--color-surface-alt)",
                color: "var(--color-text-muted)",
                cursor: "not-allowed",
              }}
            />
          </Field>
          <Field label="Location" optional>
            <input
              name="location_text"
              defaultValue={fields.location_text ?? ""}
              className="tg-control"
              placeholder="City, State"
              autoComplete="address-level2"
            />
          </Field>
        </Card>

        {/* ── Role + read-only badges ─────────────────────────────── */}
        <Card
          title="Role & stats"
          detail="These are set by the platform and can't be edited here."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ReadonlyStat
              label="Role"
              value={ROLE_LABEL[fields.user_type]}
              detail={
                fields.attendee_type
                  ? ATTENDEE_TYPE_LABEL[fields.attendee_type] ??
                    fields.attendee_type
                  : undefined
              }
            />
            <ReadonlyStat
              label="Events hosted"
              value={(fields.total_events ?? 0).toLocaleString()}
            />
            <ReadonlyStat
              label="Reviews written"
              value={(fields.total_reviews ?? 0).toLocaleString()}
            />
          </div>
        </Card>

        {/* ── Organization (ED / Admin) ───────────────────────────── */}
        {showOrgSection && (
          <Card
            title="Organization"
            detail={
              isEd
                ? "Shown on your public director page and next to every event you host."
                : "Optional — helps attribution when your name shows up on the platform."
            }
          >
            {fields.org_logo && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fields.org_logo}
                  alt=""
                  className="rounded-lg"
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "contain",
                    background: "#fff",
                    border: "1px solid var(--color-border)",
                    padding: 4,
                  }}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Logo upload isn&rsquo;t wired up yet — flag it to Franco when
                  you need it.
                </span>
              </div>
            )}
            <Field
              label={isEd ? "Organization name" : "Club affiliation"}
              optional={!isEd}
            >
              <input
                name="club_affiliation"
                defaultValue={fields.club_affiliation ?? ""}
                className="tg-control"
                placeholder="e.g. Lou Fusz Athletic"
                autoComplete="organization"
              />
            </Field>
            <Field label="Description" optional>
              <textarea
                name="org_description"
                defaultValue={fields.org_description ?? ""}
                className="tg-control"
                placeholder="What your organization does, how long you've been running events, etc."
                rows={4}
                style={{ resize: "vertical", minHeight: 96 }}
              />
            </Field>
          </Card>
        )}

        {/* ── Notifications ───────────────────────────────────────── */}
        <Card
          title="Notifications"
          detail="Choose which alerts you want by email and inside the app. Ports the notification matrix from the Bubble account section."
        >
          <div
            className="overflow-hidden rounded-lg"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <div
              className="grid gap-2 border-b p-3"
              style={{
                gridTemplateColumns: "1fr 60px 60px",
                borderColor: "var(--color-border)",
                background: "var(--color-surface-alt)",
              }}
            >
              <span
                className="font-heading uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  color: "var(--color-text-muted)",
                }}
              >
                Topic
              </span>
              <span
                className="font-heading text-center uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  color: "var(--color-text-muted)",
                }}
              >
                Email
              </span>
              <span
                className="font-heading text-center uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  color: "var(--color-text-muted)",
                }}
              >
                In-app
              </span>
            </div>
            {NOTIF_ROWS.map((row, i) => (
              <NotifRow
                key={row.emailKey}
                label={row.label}
                detail={row.detail}
                emailName={row.emailKey as string}
                emailDefault={fields[row.emailKey] as boolean | null}
                inappName={row.inappKey as string}
                inappDefault={fields[row.inappKey] as boolean | null}
                striped={i % 2 === 1}
              />
            ))}
          </div>
        </Card>

        {/* Footer save button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            style={{
              fontSize: 12.5,
              color: "var(--color-text-muted)",
            }}
          >
            Changes save to your profile immediately.
          </span>
          <button
            type="submit"
            disabled={pending}
            className="font-heading tg-hover cursor-pointer rounded-lg text-white transition-colors"
            style={{
              padding: "11px 22px",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              background: pending
                ? "var(--color-dark-light)"
                : "var(--color-dark)",
              border: "none",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── primitives ───────────────────────────────────────────────────── */

function Card({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl bg-white"
      style={{
        border: "1px solid var(--color-border)",
        padding: "18px 20px",
      }}
    >
      <div className="mb-4">
        <h2
          className="font-heading"
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--color-dark)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {detail && (
          <p
            className="mt-1 max-w-2xl"
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--color-text-secondary)",
              margin: "4px 0 0",
            }}
          >
            {detail}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-1.5 flex items-center gap-1.5"
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
        {optional && (
          <span
            style={{
              color: "var(--color-text-faint)",
              fontWeight: 500,
            }}
          >
            (optional)
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p
          className="mt-1.5"
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            margin: "6px 0 0",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function ReadonlyStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--color-surface-alt)",
        border: "1px solid var(--color-border)",
        padding: "10px 12px",
      }}
    >
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: ".12em",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      <div
        className="font-heading mt-1"
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--color-dark)",
        }}
      >
        {value}
      </div>
      {detail && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--color-text-muted)",
            marginTop: 2,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}

function NotifRow({
  label,
  detail,
  emailName,
  emailDefault,
  inappName,
  inappDefault,
  striped,
}: {
  label: string;
  detail: string;
  emailName: string;
  emailDefault: boolean | null;
  inappName: string;
  inappDefault: boolean | null;
  striped: boolean;
}) {
  const [emailOn, setEmailOn] = useState(emailDefault !== false);
  const [inappOn, setInappOn] = useState(inappDefault !== false);

  return (
    <div
      className="grid items-center gap-2 p-3"
      style={{
        gridTemplateColumns: "1fr 60px 60px",
        background: striped ? "var(--color-surface)" : "#fff",
        borderTop: "1px solid var(--color-border-light)",
      }}
    >
      <div className="min-w-0">
        <div
          className="font-heading truncate"
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--color-dark)",
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </div>
        <div
          className="mt-0.5"
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          {detail}
        </div>
      </div>
      <div className="flex justify-center">
        <NotifSwitch
          name={emailName}
          checked={emailOn}
          onChange={setEmailOn}
        />
      </div>
      <div className="flex justify-center">
        <NotifSwitch
          name={inappName}
          checked={inappOn}
          onChange={setInappOn}
        />
      </div>
    </div>
  );
}

function NotifSwitch({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className="relative rounded-full transition-colors"
        style={{
          width: 36,
          height: 20,
          background: checked ? "var(--color-dark)" : "#cbd5e1",
        }}
      >
        <span
          className="absolute rounded-full bg-white transition-all"
          style={{
            width: 16,
            height: 16,
            top: 2,
            left: checked ? 18 : 2,
            boxShadow: "0 1px 2px rgba(15,23,42,.2)",
          }}
        />
      </span>
    </label>
  );
}

function StatusBanner({
  tone,
  children,
}: {
  tone: "ok" | "error";
  children: React.ReactNode;
}) {
  const theme =
    tone === "ok"
      ? {
          bg: "#ecfdf5",
          color: "#15803d",
          border: "#bbf7d0",
          icon: "✓",
        }
      : {
          bg: "#fef2f2",
          color: "var(--color-accent-dark)",
          border: "#fecaca",
          icon: "!",
        };
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-lg px-4 py-3"
      style={{
        background: theme.bg,
        color: theme.color,
        border: `1px solid ${theme.border}`,
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      <span
        aria-hidden="true"
        className="font-heading flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: theme.color,
          color: theme.bg,
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {theme.icon}
      </span>
      {children}
    </div>
  );
}
