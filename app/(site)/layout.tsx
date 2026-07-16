import type { ReactNode } from "react";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { FlashToast, ToastProvider } from "@/app/components/ui";
import { createServerAuthClient } from "@/lib/supabase/server";

/**
 * Public marketing + discovery chrome (Header + Footer), restored from the
 * `main`-branch design. The layout is async so it can read the current
 * user's email server-side (middleware already refreshed the session
 * cookie) and hand it to the Header, avoiding a client auth round-trip.
 *
 * ToastProvider + FlashToast wrap the tree so the review/comment Server
 * Actions used on the event page can push confirmations without each page
 * mounting its own provider.
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ToastProvider>
      <FlashToast />
      <div className="flex min-h-dvh flex-col">
        <Header initialEmail={user?.email ?? null} />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
