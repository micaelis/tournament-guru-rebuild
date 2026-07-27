import { redirect } from "next/navigation";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { AddOnsPreview } from "./AddOnsPreview";

/**
 * The add-ons preview without an event attached — where the sidebar's
 * "Premium listings → Learn more" pointer lands. The event-scoped
 * variant (reached from an event's Upgrade CTA) lives at
 * /dashboard/events/[id]/add-ons and adds the "Applies to" context.
 */
export default async function AddOnsPage() {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") redirect("/events");
  return <AddOnsPreview event={null} />;
}
