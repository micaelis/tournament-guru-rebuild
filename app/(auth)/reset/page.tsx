import type { Metadata } from "next";
import { AuthTopBar, AuthHeading } from "../parts";
import { RequestResetForm } from "./RequestResetForm";

export const metadata: Metadata = { title: "Reset Password — Tournament Guru" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const sp = await searchParams;
  const initialEmail = typeof sp.email === "string" ? sp.email : "";

  return (
    <>
      <AuthTopBar rightLabel="Log in" rightHref="/login" />
      <AuthHeading
        title="Reset your password"
        subtitle="Enter the email you signed up with and we’ll send you a link to set a new password."
      />
      <RequestResetForm initialEmail={initialEmail} />
    </>
  );
}
