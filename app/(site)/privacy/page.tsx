import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "Privacy Policy · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Privacy Policy"
      body="Our privacy policy is being finalized and will be published here soon."
    />
  );
}
