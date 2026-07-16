import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata: Metadata = { title: "Reviews · Tournament Guru" };

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Reviews"
      body="Browse verified tournament reviews from coaches, managers, and parents. Coming soon."
    />
  );
}
