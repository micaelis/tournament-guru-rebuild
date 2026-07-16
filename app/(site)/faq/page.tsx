import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "Frequently Asked Questions · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Frequently Asked Questions"
      body="Answers to the questions we hear most, coming soon."
    />
  );
}
