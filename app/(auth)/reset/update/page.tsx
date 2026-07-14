import type { Metadata } from "next";
import { AuthTopBar, AuthHeading } from "../../parts";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata: Metadata = { title: "Set New Password — Tournament Guru" };

export default function UpdatePasswordPage() {
  return (
    <>
      <AuthTopBar rightLabel="Log in" rightHref="/login" />
      <AuthHeading
        title="Set a new password"
        subtitle="Choose a new password for your account. You’ll be signed in once it’s saved."
      />
      <UpdatePasswordForm />
    </>
  );
}
