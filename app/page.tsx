import { redirect } from "next/navigation";

/**
 * Rebuild placeholder. The public marketing/discovery landing lands in
 * Slice 5; until then the root routes to the events search stub (Slice 1
 * placeholder) so signed-in users don't hit a 404 after onboarding.
 */
export default function Home() {
  redirect("/events");
}
