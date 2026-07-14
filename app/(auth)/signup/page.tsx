import type { Metadata } from "next";
import { AuthTopBar, AuthHeading } from "../parts";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Sign Up — Tournament Guru" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;

  return (
    <>
      <AuthTopBar rightLabel="Log in" rightHref="/login" />
      <AuthHeading
        title="Create your account"
        subtitle="Get the facts from the Gurus before your team’s next tournament."
      />
      <SignupForm next={next} />
    </>
  );
}
