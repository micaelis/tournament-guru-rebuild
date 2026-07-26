import Link from "next/link";
import AuthShell from "../../AuthShell";
import { AuthEyebrow } from "../../parts";
import { TextLink } from "@/app/components/ui";

export const metadata = {
  title: "Verify your email · Tournament Guru",
};

/* Standalone post-signup screen (prod path: confirmations on, no
   session yet). The signup action redirects here instead of flashing a
   banner above the emptied form. Deliberately shows no email address —
   nothing personal rides the URL. */

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <div className="max-w-lg">
        <AuthEyebrow>One more step</AuthEyebrow>

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
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </span>

        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Check your email
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          Your account was created. We just sent you a confirmation link —
          click it to activate your account, then sign in and you&rsquo;re
          off to the races.
        </p>

        <ol className="mt-6 space-y-3">
          {[
            "Open the email from Tournament Guru",
            "Click the confirmation link inside",
            "Sign in and finish setting up your profile",
          ].map((step, i) => (
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

        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-[14.5px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: "var(--color-dark)" }}
          >
            Go to sign in
          </Link>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Nothing in your inbox? Check your spam folder, or{" "}
          <TextLink href="/signup">sign up again</TextLink>{" "}
          with the right address.
        </p>
      </div>
    </AuthShell>
  );
}
