import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "For Event Directors · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="For Event Directors"
      body="Claim, list, and promote your tournaments. The event-director hub is coming soon."
    />
  );
}
