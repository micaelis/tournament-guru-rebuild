import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

/**
 * Public site chrome (Header + Footer) for marketing / discovery pages.
 * Auth and onboarding live in their own route groups and opt out of this.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
