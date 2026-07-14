import { TGLogo } from "../../components/TGLogo";

/**
 * Minimal centered shell for the onboarding wizard — brand aurora background,
 * logo top-left, no site Header/Footer. The stepper + card are rendered by the
 * page itself so it can react to the current step.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tg-aurora min-h-dvh">
      <header className="mx-auto flex max-w-[720px] items-center px-6 pt-7">
        <TGLogo href="/" />
      </header>
      <main className="mx-auto max-w-[720px] px-6 pb-16 pt-6">{children}</main>
    </div>
  );
}
