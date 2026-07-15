import { requireSessionAndProfile } from "@/lib/supabase/session";
import { SliceStub } from "../SliceStub";
import { Button } from "@/app/components/ui";

/**
 * Slice 1 delivers real tournaments + events CRUD. Until then this is
 * the ED / Admin landing tab. Attendee lands here only via URL — the
 * shell will surface it as "not on your nav" and the sidebar hides it.
 */
export default async function EventsDashboardPage() {
  const { profile } = await requireSessionAndProfile();
  const isAdmin = profile.user_type === "admin";
  return (
    <SliceStub
      title={isAdmin ? "Events (Admin)" : "Your Events"}
      slice="Slice 1 — Events"
      detail={
        isAdmin
          ? "Admin has the same primitives as an ED, plus search-by-owner, an owner column, CSV export, and the QR generate/open utilities."
          : "You'll be able to create tournaments, add events under them, publish / cancel, and see derived statuses + per-category ratings."
      }
      cta={<Button variant="ghost" disabled>Add new tournament</Button>}
    />
  );
}
