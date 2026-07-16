import Link from "next/link";
import RequestResetForm from "./RequestResetForm";
import AuthShell from "../AuthShell";
import { AuthEyebrow } from "../parts";

export default function ResetPage() {
  return (
    <AuthShell>
      <div className="max-w-md">
        <AuthEyebrow>Reset password</AuthEyebrow>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the email you signed up with and we&apos;ll send you a reset
          link.
        </p>
        <div className="mt-8">
          <RequestResetForm />
        </div>
        <p className="mt-6 text-sm text-slate-600">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-red-600">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
