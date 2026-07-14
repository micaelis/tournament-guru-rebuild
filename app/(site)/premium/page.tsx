import { ComingSoon } from "@/app/components/ComingSoon";

export const metadata = { title: "Premium Events · Tournament Guru" };

export default function PremiumPage() {
  return (
    <ComingSoon
      eyebrow="Premium Events"
      title="Featured premium tournaments"
      body="A curated showcase of premium, coach-reviewed tournaments. This page is coming soon."
    />
  );
}
