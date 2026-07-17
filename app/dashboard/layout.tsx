import type { ReactNode } from "react";
import { Suspense } from "react";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { navFor } from "./nav-items";
import { Sidebar } from "./Sidebar";
import { SpotlightColumn } from "./SpotlightColumn";
import {
  FlashToast,
  ToastProvider,
} from "@/app/components/ui";

const ROLE_LABELS: Record<string, string> = {
  event_director: "Event Director",
  event_admin: "Event Admin",
  club_director: "Club Director",
  coach: "Coach",
  team_manager: "Team Manager",
  parent_spectator: "Parent / Spectator",
};

/**
 * Dashboard shell. Enforces auth + completed onboarding + not-blocked
 * via requireSessionAndProfile (redirects on failure). Wraps the
 * content in a role-scoped sidebar + toast provider so any interior
 * page can push a flash notification.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireSessionAndProfile();
  const items = navFor(profile.user_type);
  const roleLabel =
    profile.user_type === "admin"
      ? "Admin"
      : ROLE_LABELS[profile.role_title] ?? profile.role_title;

  return (
    <ToastProvider>
      <FlashToast />
      <div className="min-h-dvh bg-slate-50">
        <div className="mx-auto flex max-w-[1440px]">
          <Sidebar
            items={items}
            user={{
              first_name: profile.first_name,
              last_name: profile.last_name,
              profile_photo_url: profile.profile_photo_url,
              role_label: roleLabel,
            }}
          />
          <main className="flex-1 px-6 py-8 md:px-12 md:py-12">
            <div className="mx-auto flex max-w-6xl gap-8">
              <div className="min-w-0 flex-1">{children}</div>
              {profile.user_type === "attendee" && (
                <Suspense>
                  <SpotlightColumn />
                </Suspense>
              )}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
