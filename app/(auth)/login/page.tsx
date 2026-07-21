import { TextLink } from "@/app/components/ui";
import LoginForm from "./LoginForm";
import AuthShell from "../AuthShell";
import { AuthEyebrow } from "../parts";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const initialInfo =
    sp.reset === "success"
      ? "Your password has been updated. Sign in with your new password."
      : undefined;

  return (
    <AuthShell>
      <div className="max-w-md">
        <AuthEyebrow>Sign in</AuthEyebrow>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to continue where you left off.
        </p>
        <div className="mt-8">
          <LoginForm next={next} initialInfo={initialInfo} />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          New here?{" "}
          <TextLink href="/signup">Create an account</TextLink>
        </p>
      </div>
    </AuthShell>
  );
}
