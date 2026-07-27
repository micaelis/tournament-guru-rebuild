import { notFound, redirect } from "next/navigation";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { createServerAuthClient } from "@/lib/supabase/server";
import { AddOnsPreview } from "@/app/dashboard/add-ons/AddOnsPreview";
import { deriveEventStatus } from "../../event-shared";
import { safeImageSrc } from "@/lib/url";
import { formatDateRange } from "../details-parts";

type Params = { id: string };

type AddOnEventRow = {
  id: string;
  title: string;
  logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  lifecycle: "draft" | "active" | "canceled";
  is_premium: boolean;
  is_general_ad: boolean;
};

/**
 * The add-ons preview scoped to one event — where an event's Upgrade
 * CTA lands. Display-only: the event feeds the back link and the price
 * rail's "Applies to" card; nothing on the page mutates it (payments
 * are deferred, so the whole add-on feature is a coming-soon preview).
 */
export default async function EventAddOnsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type === "attendee") redirect("/events");
  const { id } = await params;

  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, logo_url, start_date, end_date, lifecycle, is_premium, is_general_ad",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const event = data as unknown as AddOnEventRow;

  return (
    <AddOnsPreview
      event={{
        id: event.id,
        title: event.title || "Untitled event",
        logoUrl: safeImageSrc(event.logo_url),
        status: deriveEventStatus(event),
        dateRange: formatDateRange(event.start_date, event.end_date),
        isPremium: event.is_premium,
        isGeneralAd: event.is_general_ad,
      }}
    />
  );
}
