import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/app/components/Avatar";
import { Stars } from "@/app/components/Stars";
import {
  getAttendeePublicProfile,
  getEventTitles,
} from "@/lib/attendees/queries";
import {
  listReviewsForAuthor,
  listCommentsForReview,
  getUserHelpfulSet,
} from "@/lib/reviews/queries";
import { fetchBannedWords } from "@/lib/reviews/banned-words";
import { createServerAuthClient } from "@/lib/supabase/server";
import { rolesFor } from "@/lib/enums";
import { AttendeeReviews } from "./parts";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getAttendeePublicProfile(id);
  return {
    title: `${profile?.display_name ?? "Attendee"} · Tournament Guru`,
  };
}

/* Public attendee profile — /attendees/[id]. Identity through
   public_attendees only (first name + last initial); deleted, blocked,
   or not-yet-onboarded users 404. */
export default async function AttendeePublicPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const profile = await getAttendeePublicProfile(id);
  if (!profile) notFound();

  const supabaseAuth = await createServerAuthClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  const [reviews, bannedWords] = await Promise.all([
    listReviewsForAuthor(id),
    fetchBannedWords(),
  ]);
  const eventTitleById = await getEventTitles(
    Array.from(
      new Set(
        reviews.map((r) => r.event_id).filter((v): v is string => Boolean(v)),
      ),
    ),
  );

  const [commentsByReviewArr, helpfulSet, isAdmin] = await Promise.all([
    Promise.all(
      reviews.map(async (r) => ({
        id: r.id,
        comments: await listCommentsForReview(r.id),
      })),
    ),
    user
      ? getUserHelpfulSet(
          user.id,
          reviews.map((r) => r.id),
        )
      : Promise.resolve(new Set<string>()),
    (async () => {
      if (!user) return false;
      const { data } = await supabaseAuth
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
      return data?.user_type === "admin";
    })(),
  ]);
  const commentsByReview: Record<
    string,
    (typeof commentsByReviewArr)[number]["comments"]
  > = {};
  for (const c of commentsByReviewArr) commentsByReview[c.id] = c.comments;

  const roleLabel =
    rolesFor("attendee").find((r) => r.value === profile.role_title)?.label ??
    profile.role_title;

  return (
    <div className="min-h-dvh" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto max-w-[980px] px-4 pt-8 pb-16 sm:px-6">
        {/* ── Header card — identity + at-a-glance ─────────────────── */}
        <section
          className="rounded-2xl bg-white p-4 sm:p-6"
          style={{
            border: "1px solid var(--color-border)",
            boxShadow: "0 1px 2px rgba(15,23,42,.05)",
          }}
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Avatar
              src={profile.profile_photo_url}
              name={profile.display_name}
              size={104}
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1
                className="font-heading"
                style={{
                  fontSize: "clamp(24px, 3vw, 32px)",
                  fontWeight: 800,
                  color: "var(--color-dark)",
                  letterSpacing: "-0.025em",
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                {profile.display_name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:justify-start">
                <span
                  className="font-heading inline-flex items-center rounded-full uppercase"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: ".1em",
                    color: "var(--color-accent)",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    padding: "3px 10px",
                  }}
                >
                  {roleLabel}
                </span>
                {profile.location && (
                  <span
                    className="inline-flex items-center gap-1"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <PinIcon />
                    {profile.location}
                  </span>
                )}
                {profile.club_affiliation && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {profile.club_affiliation}
                  </span>
                )}
              </div>
              <p
                className="mt-2.5"
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  margin: 0,
                }}
              >
                {profile.total_published} published review
                {profile.total_published === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {/* Metric blocks — avg score GIVEN in each capacity. */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GivenRatingCard
              label="Reviews as Verified Coach"
              rating={profile.coach_rating}
              count={profile.coach_reviews}
            />
            <GivenRatingCard
              label="Reviews as Attendee"
              rating={profile.attendee_rating}
              count={profile.attendee_reviews}
            />
          </div>
        </section>

        {/* ── Reviews (client filter + cards with comments) ─────────── */}
        <section className="mt-6">
          <AttendeeReviews
            reviews={reviews}
            commentsByReview={commentsByReview}
            helpfulReviewIds={Array.from(helpfulSet)}
            currentUserId={user?.id ?? null}
            isAdmin={isAdmin}
            bannedWords={bannedWords}
            eventTitleById={eventTitleById}
          />
        </section>
      </div>
    </div>
  );
}

function GivenRatingCard({
  label,
  rating,
  count,
}: {
  label: string;
  rating: number;
  count: number;
}) {
  const has = rating > 0;
  return (
    <div
      className="rounded-2xl bg-white text-center"
      style={{
        border: "1px solid var(--color-border)",
        padding: "16px 20px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}
    >
      <div
        className="font-heading uppercase"
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".12em",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
      <div className="mt-2.5 flex items-center justify-center">
        <Stars rating={has ? rating : 0} size={18} />
      </div>
      <div
        className="font-heading mt-1"
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          color: "var(--color-dark)",
        }}
      >
        {has ? rating.toFixed(2) : "—"} <span style={{ opacity: 0.4 }}>/ 5</span>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text-muted)",
        }}
      >
        {count} review{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
