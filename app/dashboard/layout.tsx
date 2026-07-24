import type { ReactNode } from "react";
import { Suspense } from "react";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { ROLE_LABELS } from "@/lib/enums";
import { navFor } from "./nav-items";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./Header";
import { SpotlightColumn } from "./SpotlightColumn";
import {
  FlashToast,
  ToastProvider,
} from "@/app/components/ui";

/**
 * Dashboard shell. Enforces auth + completed onboarding + not-blocked
 * via requireSessionAndProfile (redirects on failure). Wraps the
 * content in a role-scoped sidebar + top header (breadcrumb + user
 * menu carrying Account/Log out) + toast provider so any interior
 * page can push a flash notification.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, profile } = await requireSessionAndProfile();
  const items = navFor(profile.user_type);
  const roleLabel =
    profile.user_type === "admin"
      ? "Admin"
      : ROLE_LABELS[profile.role_title] ?? profile.role_title;
  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "Your account";

  return (
    <ToastProvider>
      <FlashToast />
      <div className="min-h-dvh bg-slate-50">
        <div className="mx-auto flex max-w-[1440px]">
          <Sidebar
            items={items}
            userType={profile.user_type}
            orgTitle={profile.organization_title}
            orgLogoUrl={profile.org_logo_url}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <DashboardHeader
              items={items}
              user={{
                name: fullName,
                roleLabel,
                email: user.email,
                photoUrl: profile.profile_photo_url,
              }}
            />
            <main className="flex-1 px-6 py-8 md:px-12 md:py-10">
              <div className="mx-auto flex max-w-6xl gap-8">
                <div className="min-w-0 flex-1">{children}</div>
                {profile.user_type === "attendee" && (
                  <Suspense>
                    <SpotlightColumn userId={profile.id} />
                  </Suspense>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
