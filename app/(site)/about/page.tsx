import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "About Tournament Guru · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="About Tournament Guru"
      body="The full story behind the most comprehensive youth-sports tournament search engine is on the way."
    />
  );
}
