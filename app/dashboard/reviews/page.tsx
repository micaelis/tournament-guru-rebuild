import type { Metadata } from "next";
import { requireSessionAndProfile } from "@/lib/supabase/session";
import { getDashboardReviews } from "@/lib/supabase/queries";
import { ReviewsManager } from "./parts";

export const metadata: Metadata = {
  title: "Reviews · Dashboard · Tournament Guru",
};

export default async function DashboardReviewsPage() {
  const { user, profile } = await requireSessionAndProfile();

  // Same role split as the events page:
  //   * Admin  → every review on the platform
  //   * ED     → reviews on the events they host
  //   * Anyone else lands here via the "shared" nav item; we scope to
  //     their id so they see nothing rather than everyone's data.
  const isAdmin = profile.user_type === "admin";
  const ownerId = isAdmin ? null : user.id;

  const { data: reviews, error } = await getDashboardReviews({ ownerId });

  return (
    <ReviewsManager
      reviews={reviews}
      error={error}
      role={profile.user_type}
    />
  );
}
