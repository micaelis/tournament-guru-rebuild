import Link from "next/link";
import SignupForm from "./SignupForm";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const preselectType =
    sp.type === "event_director" || sp.type === "attendee" ? sp.type : undefined;

  return (
    <div className="max-w-lg">
      <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Two quick things — who you are and how we reach you.
      </p>
      <div className="mt-8">
        <SignupForm preselectType={preselectType} />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-red-600">
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-sm text-slate-500">
        Just browsing?{" "}
        <Link href="/events" className="font-semibold text-slate-700 underline">
          Skip and search events
        </Link>
      </p>
    </div>
  );
}
