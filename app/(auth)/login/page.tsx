import type { Metadata } from "next";
import { AuthTopBar, AuthHeading } from "../parts";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log In — Tournament Guru" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  const initialError =
    sp.error === "callback" || sp.error === "oauth"
      ? "That sign-in didn’t complete. Please try again."
      : undefined;

  return (
    <>
      <AuthTopBar rightLabel="Sign up" rightHref="/signup" />
      <AuthHeading
        title="Log In"
        subtitle="Welcome back. Sign in to write reviews, favorite events, and manage your teams."
      />
      <LoginForm next={next} initialError={initialError} />
    </>
  );
}
