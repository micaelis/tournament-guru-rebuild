import { AuthPanel } from "../components/AuthPanel";

/**
 * Split-screen auth shell: form column on the left, decorative brand panel on
 * the right (which collapses below lg). No site Header/Footer here.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_1.05fr]">
      {/* Left: form column */}
      <div className="flex min-h-dvh flex-col justify-center bg-white px-6 py-10 sm:px-10">
        <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
          {children}
        </div>
      </div>

      {/* Right: brand panel (hidden below lg) */}
      <AuthPanel />
    </div>
  );
}
