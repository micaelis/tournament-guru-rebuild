import type { ReactNode } from "react";
import AuthLayout from "../(auth)/layout";

/** Onboarding reuses the auth shell (form-left, glass-right). */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
