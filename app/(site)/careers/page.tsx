import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "Careers · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Careers"
      body="Want to help families find the right tournament? Openings coming soon."
    />
  );
}
