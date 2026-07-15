import { requireSessionAndProfile } from "@/lib/supabase/session";

/**
 * Placeholder for Slice 1 (Events CRUD). The dashboard shell lands here
 * for EDs and Admins post-onboarding.
 */
export default async function DashboardEventsPage() {
  const { profile } = await requireSessionAndProfile();
  return (
    <div>
      <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-slate-900">
        Events
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {profile.user_type === "admin"
          ? "The admin-wide Events surface (Slice 1)."
          : "Your tournaments and events (Slice 1)."}{" "}
        We&apos;re shipping this in the next slice.
      </p>
    </div>
  );
}
