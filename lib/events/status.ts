import { deriveEventStatus } from "@/app/dashboard/events/event-shared";

/**
 * The restored `main` presentation components (EventCard, FeaturedShowcase,
 * event parts) branch on the OLD status vocabulary — lowercase
 * `draft | open | concluded | canceled`. The new schema derives a richer
 * status (Draft / Upcoming / Ongoing / Concluded / Canceled) from
 * lifecycle + dates. Collapse it to the legacy set so the design's
 * conditional rendering (concluded dim, "open" pills, etc.) works
 * unchanged. Upcoming + Ongoing both map to "open".
 */
export function legacyStatus(row: {
  lifecycle: "draft" | "active" | "canceled";
  start_date: string | null;
  end_date: string | null;
}): "draft" | "open" | "concluded" | "canceled" {
  const s = deriveEventStatus(row);
  if (s === "Draft") return "draft";
  if (s === "Canceled") return "canceled";
  if (s === "Concluded") return "concluded";
  return "open";
}
