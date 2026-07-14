import type { Metadata } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { getDashboardEvents } from "@/lib/supabase/queries";
import { EventsManager } from "./parts";

export const metadata: Metadata = {
  title: "Events · Dashboard · Tournament Guru",
};

export default async function DashboardEventsPage() {
  const { user, profile } = await requireSessionAndProfile();

  // Role logic mirrors the Bubble dashboard-events A section: Admins see
  // every event on the platform; Event Directors see only events they own.
  // Attendees / Company shouldn't reach this route (the layout redirects
  // them). If they somehow do, we still scope to their id so they see
  // nothing rather than everyone's data.
  const isAdmin = profile.user_type === "admin";
  const ownerId = isAdmin ? null : user.id;

  const { data: events, error } = await getDashboardEvents({ ownerId });

  return (
    <EventsManager
      events={events}
      error={error}
      role={profile.user_type}
    />
  );
}
