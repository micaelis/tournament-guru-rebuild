import UpdatePasswordForm from "./UpdatePasswordForm";
import AuthShell from "../../AuthShell";

export default function UpdatePasswordPage() {
  return (
    <AuthShell>
      <div className="max-w-md">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Pick a strong password you haven&apos;t used before.
        </p>
        <div className="mt-8">
          <UpdatePasswordForm />
        </div>
      </div>
    </AuthShell>
  );
}
