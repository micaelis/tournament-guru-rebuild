import Link from "next/link";
import type { Route } from "next";
import { redirect, notFound } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { fetchBannedWords } from "@/lib/reviews/banned-words";
import { getMyReviewForEvent } from "@/lib/reviews/queries";
import { ReviewWriteForm } from "./ReviewWriteForm";
import { isReviewStillEditable } from "@/lib/reviews/shared";
import { Button } from "@/app/components/ui";

type Params = { id: string };

/**
 * Write / edit review flow. Requires a signed-in attendee (spec:
 * only attendees can post reviews; EDs and admins that hit this route
 * bounce back to the event page).
 *
 * If the caller has never reviewed this event, the form loads empty.
 * If they have, we load their existing row as defaults and treat the
 * submit as an update. Publishing past the 30-day edit window on a
 * published row is blocked at the action layer.
 */
export default async function ReviewWritePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/events/${id}/review`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type, role_title, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle<{
      user_type: "attendee" | "event_director" | "admin";
      role_title: string;
      onboarding_completed: boolean;
    }>();
  if (!profile) redirect("/login");
  if (!profile.onboarding_completed) redirect("/onboarding");
  if (profile.user_type !== "attendee") {
    redirect(`/events/${id}?msg=attendees-only`);
  }

  const [{ data: event }, myReview, bannedWords] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, host_club, start_date, end_date, logo_url")
      .eq("id", id)
      .maybeSingle(),
    getMyReviewForEvent(user.id, id),
    fetchBannedWords(),
  ]);
  if (!event) notFound();
  const ev = event as {
    id: string;
    title: string;
    host_club: string | null;
    start_date: string | null;
    end_date: string | null;
    logo_url: string | null;
  };

  const alreadyPublished = myReview?.status === "published";
  const editWindowOk = isReviewStillEditable(ev.end_date);
  const isLocked = alreadyPublished && !editWindowOk;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/events/${id}` as Route}
        className="text-sm font-semibold text-slate-700 underline"
      >
        ← Back to {ev.title}
      </Link>
      <h1 className="mt-4 font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
        {myReview ? "Edit your review" : "Write a review"}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {ev.title}
        {ev.host_club && ` · Hosted by ${ev.host_club}`}
      </p>

      {isLocked ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          <p>
            This event ended more than 30 days ago, so published reviews are
            locked from further edits. Your review is still visible on the
            event page.
          </p>
          <div className="mt-5">
            <Link href={`/events/${id}` as Route}>
              <Button variant="ghost">Back to event</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <ReviewWriteForm
            eventId={ev.id}
            defaults={
              myReview
                ? {
                    reviewId: myReview.id,
                    review_title: myReview.review_title ?? "",
                    review_body: myReview.review_body ?? "",
                    rating_fields: myReview.rating_fields,
                    rating_facilities: myReview.rating_facilities,
                    rating_management: myReview.rating_management,
                    rating_competition: myReview.rating_competition,
                    rating_diversity: myReview.rating_diversity,
                    rating_cost_value: myReview.rating_cost_value,
                    would_return: myReview.would_return,
                    status: myReview.status,
                  }
                : null
            }
            reviewerRole={profile.role_title}
            bannedWords={bannedWords}
          />
        </div>
      )}
    </main>
  );
}
