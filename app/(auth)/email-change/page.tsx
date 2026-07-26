import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import AuthShell from "../AuthShell";
import { AuthEyebrow } from "../parts";
import { TextLink } from "@/app/components/ui";
import { createServerAuthClient } from "@/lib/supabase/server";
import { StripUrlHash } from "./StripUrlHash";

export const metadata = {
  title: "Email change · Tournament Guru",
};

/*
 * Dedicated landing screen for the email-change confirmation links
 * (/auth/callback routes every email-change leg here — see the route).
 * Secure email change sends a link to BOTH the current and the new
 * address, so the screen narrates the two-step dance:
 *
 *   ?stage=partial — first link clicked; the other inbox still holds one.
 *   (none), session — second link clicked in the requesting browser; the
 *                     session already carries the new address.
 *   (none), no session — second link clicked elsewhere (phone mail app);
 *                     change is done, they just need to sign in again.
 *   ?stage=error   — expired / already-used / malformed link.
 */
export default async function EmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;

  if (stage === "partial") {
    return (
      <Screen
        eyebrow="Email change"
        icon={ICON_MAIL}
        title="One link down — one to go"
        body={
          <>
            For security, changing your sign-in email takes a click from{" "}
            <b>both</b> addresses — your current one and your new one. This
            link is confirmed; now open the <b>other</b> inbox and click the
            link waiting there.
          </>
        }
        steps={[
          "Open the inbox you haven't checked yet",
          "Click the confirmation link from Tournament Guru",
          "You're done — sign in with the new address from then on",
        ]}
        cta={{ href: "/", label: "Back to Tournament Guru" }}
        footer={
          <>
            No second email? Check that inbox&rsquo;s spam folder, or request
            the change again from{" "}
            <TextLink href="/dashboard/account">account settings</TextLink>.
          </>
        }
      />
    );
  }

  if (stage === "error") {
    return (
      <Screen
        eyebrow="Email change"
        icon={ICON_ALERT}
        title="That link didn't work"
        body={
          <>
            The confirmation link is expired, already used, or invalid. If
            you&rsquo;ve already clicked the links from both inboxes, your
            email may be updated — try signing in with the new address.
            Otherwise, request the change again from account settings.
          </>
        }
        cta={{ href: "/dashboard/account", label: "Back to account settings" }}
        footer={
          <>
            Signed out? <TextLink href="/login">Sign in</TextLink> first, then
            send a fresh confirmation from account settings.
          </>
        }
      />
    );
  }

  // Final leg — both links clicked. If the exchange signed this browser
  // in, the session already carries the new address; otherwise the change
  // is done server-side and they just need to sign in with it.
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <Screen
        eyebrow="Email change"
        icon={ICON_CHECK}
        title="Email updated"
        body={
          <>
            All set — your sign-in email is now{" "}
            <b className="text-slate-900">{user.email}</b>. Use it the next
            time you log in.
          </>
        }
        cta={{ href: "/dashboard/account", label: "Back to your account" }}
      />
    );
  }

  return (
    <Screen
      eyebrow="Email change"
      icon={ICON_CHECK}
      title="Email confirmed"
      body={
        <>
          Both links are confirmed and your sign-in email has been updated.
          Sign in with your <b>new</b> address to pick up where you left
          off.
        </>
      }
      cta={{ href: "/login", label: "Sign in with your new email" }}
    />
  );
}

function Screen({
  eyebrow,
  icon,
  title,
  body,
  steps,
  cta,
  footer,
}: {
  eyebrow: string;
  icon: ReactNode;
  title: string;
  body: ReactNode;
  steps?: string[];
  cta: { href: string; label: string };
  footer?: ReactNode;
}) {
  return (
    <AuthShell>
      <div className="max-w-lg">
        <StripUrlHash />
        <AuthEyebrow>{eyebrow}</AuthEyebrow>

        <span
          className="mb-5 mt-1 inline-flex items-center justify-center rounded-2xl"
          style={{
            width: 56,
            height: 56,
            background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
            border: "1px solid #fecaca",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {icon}
          </svg>
        </span>

        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          {body}
        </p>

        {steps && (
          <ol className="mt-6 space-y-3">
            {steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  className="font-[var(--font-heading)] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold"
                  style={{
                    background: "var(--color-surface-alt)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-dark)",
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-[14px] font-medium text-slate-700">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-8">
          <Link
            href={cta.href as Route}
            className="inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-[14.5px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--color-dark)" }}
          >
            {cta.label}
          </Link>
        </div>

        {footer && (
          <p className="mt-5 text-center text-sm text-slate-500">{footer}</p>
        )}
      </div>
    </AuthShell>
  );
}

const ICON_MAIL = (
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M3 7l9 6 9-6" />
  </>
);
const ICON_CHECK = (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M8 12.5l2.7 2.7L16 9.5" />
  </>
);
const ICON_ALERT = (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </>
);
