import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { createServerAuthClient } from "@/lib/supabase/server";

/**
 * Public site chrome (Header + Footer) for marketing / discovery pages.
 * Auth and onboarding live in their own route groups and opt out of this.
 *
 * The layout is async so it can derive the current user's email on the
 * server (the middleware has already refreshed the session cookie) and
 * pass it to the Header. That eliminates the client-side auth round-trip
 * previously done by HeaderAuth on every navigation.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header initialEmail={user?.email ?? null} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
