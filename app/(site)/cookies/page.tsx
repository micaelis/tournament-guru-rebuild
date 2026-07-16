import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "Cookie Policy · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Cookie Policy"
      body="Our cookie policy is being finalized and will be published here soon."
    />
  );
}
