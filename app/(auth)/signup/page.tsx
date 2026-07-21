import SignupForm from "./SignupForm";
import AuthShell from "../AuthShell";
import { AuthEyebrow } from "../parts";
import { TextLink } from "@/app/components/ui";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const preselectType =
    sp.type === "event_director" || sp.type === "attendee" ? sp.type : undefined;

  // Arriving from a "Claim / List your event free" CTA (type=event_director)
  // shows the ED-claim welcome copy on the right panel (spec §4).
  const variant =
    preselectType === "event_director" ? "ed-claim" : "default";

  return (
    <AuthShell variant={variant}>
      <div className="max-w-lg">
        <AuthEyebrow>Create account</AuthEyebrow>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Two quick things — who you are and how we reach you.
        </p>
        <div className="mt-8">
          <SignupForm preselectType={preselectType} />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <TextLink href="/login">Sign in</TextLink>
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          Just browsing?{" "}
          <TextLink href="/events">Skip and search events</TextLink>
        </p>
      </div>
    </AuthShell>
  );
}
