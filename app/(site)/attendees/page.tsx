import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "For Attendees · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="For Attendees"
      body="Everything coaches, parents, and managers need to find the right event — coming soon."
    />
  );
}
