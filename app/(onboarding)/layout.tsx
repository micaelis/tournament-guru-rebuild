import type { ReactNode } from "react";
import AuthShell from "../(auth)/AuthShell";

/** Onboarding reuses the shared auth shell (form-left, glass-right). */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
