import { redirect } from "next/navigation";
import { requireSessionAndProfile } from "@/lib/supabase/session";

/** Roots to the role-appropriate landing tab. */
export default async function DashboardIndex() {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") redirect("/dashboard/reviews");
  redirect("/dashboard/events");
}
