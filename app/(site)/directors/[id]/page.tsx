import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "@/app/components/ui/SafeImg";
import { Avatar } from "@/app/components/Avatar";
import {
  getDirectorProfile,
  getDirectorEventRows,
} from "@/lib/directors/queries";
import {
  listReviewsForEvents,
  listCommentsForReview,
  getUserHelpfulSet,
} from "@/lib/reviews/queries";
import { fetchBannedWords } from "@/lib/reviews/banned-words";
import { createServerAuthClient } from "@/lib/supabase/server";
import { DirectorTabs } from "./parts";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getDirectorProfile(id);
  const name = profile?.display_name ?? "Event Director";
  return {
    title: `${name} · Tournament Guru`,
    description: profile?.org_description ?? undefined,
  };
}

export default async function DirectorPublicPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const profile = await getDirectorProfile(id);
  if (!profile) notFound();

  const supabaseAuth = await createServerAuthClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  const [events, bannedWords] = await Promise.all([
    getDirectorEventRows(id),
    fetchBannedWords(),
  ]);
  const reviews = await listReviewsForEvents(events.map((e) => e.id));

  // Same wiring as the public event page: eager comments per review,
  // the viewer's helpful set, and the admin flag for moderation affordances.
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

  const eventTitleById: Record<string, string> = {};
  for (const e of events) eventTitleById[e.id] = e.title;

  return (
    <div
      className="min-h-dvh"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="mx-auto max-w-[1180px] px-4 pt-8 pb-16 sm:px-6">
        {/* ── Header card — org identity + at-a-glance stats. Mobile
             friendly: stacks logo, name, and stat blocks on narrow widths;
             places them side-by-side from md up. */}
        <section
          className="rounded-2xl bg-white p-4 sm:p-6"
          style={{
            border: "1px solid var(--color-border)",
            boxShadow: "0 1px 2px rgba(15,23,42,.05)",
          }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Left: logo + identity */}
            <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:gap-5">
              <OrgLogoLarge
                logo={profile.org_logo}
                name={profile.display_name}
              />
              <div className="min-w-0 text-center md:text-left">
                <h1
                  className="font-heading"
                  style={{
                    fontSize: "clamp(22px, 2.8vw, 30px)",
                    fontWeight: 800,
                    color: "var(--color-dark)",
                    letterSpacing: "-0.025em",
                    lineHeight: 1.12,
                    margin: 0,
                  }}
                >
                  {profile.display_name}
                </h1>
                {profile.club_affiliation && (
                  <div
                    className="mt-1 truncate font-heading uppercase"
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: ".14em",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {profile.club_affiliation}
                  </div>
                )}
                {profile.org_description && (
                  <p
                    className="mx-auto mt-3 max-w-xl md:mx-0"
                    style={{
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "var(--color-text-secondary)",
                      margin: 0,
                    }}
                  >
                    {profile.org_description}
                  </p>
                )}
                {profile.director_name && (
                  <div className="mt-3.5 inline-flex items-center gap-2.5 rounded-full border py-1 pl-1 pr-3.5"
                    style={{
                      borderColor: "var(--color-border)",
                      background: "var(--color-surface-alt)",
                    }}
                  >
                    <Avatar
                      src={profile.profile_picture}
                      name={profile.director_name}
                      size={28}
                    />
                    <div className="text-left">
                      <div
                        className="font-heading uppercase"
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          letterSpacing: ".12em",
                          color: "var(--color-text-muted)",
                          lineHeight: 1.2,
                        }}
                      >
                        Event Director
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--color-dark)",
                          lineHeight: 1.25,
                        }}
                      >
                        {profile.director_name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: stats grid — 2×2 on all sizes so it stays compact
                and reads at a glance. */}
            <div className="grid grid-cols-2 gap-2.5 md:ml-auto md:min-w-[300px]">
              <RatingCard
                label="Coach Rating"
                value={profile.coach_rating}
                count={profile.coach_reviews}
                accent="var(--color-accent)"
                accentBg="#fef2f2"
              />
              <RatingCard
                label="Attendee Rating"
                value={profile.attendee_rating}
                count={profile.attendee_reviews}
                accent="var(--color-gold)"
                accentBg="#fffbeb"
              />
              <CountCard
                label="Completed Events"
                value={profile.completed_events}
                icon={<CheckIcon />}
                tint="var(--color-dark)"
              />
              <CountCard
                label="Open Events"
                value={profile.open_events}
                icon={<ClockIcon />}
                tint="var(--color-dark-mid)"
              />
            </div>
          </div>
        </section>

        {/* ── Tabs: Events | Reviews (client-side switch) ────────────── */}
        <section className="mt-6">
          <DirectorTabs
            eventCount={events.length}
            reviewCount={reviews.length}
            events={events}
            reviews={reviews}
            commentsByReview={commentsByReview}
            helpfulReviewIds={Array.from(helpfulSet)}
            currentUserId={user?.id ?? null}
            isAdmin={isAdmin}
            bannedWords={bannedWords}
            eventTitleById={eventTitleById}
            coachSummary={{
              rating: profile.coach_rating,
              reviews: profile.coach_reviews,
            }}
            attendeeSummary={{
              rating: profile.attendee_rating,
              reviews: profile.attendee_reviews,
            }}
          />
        </section>
      </div>
    </div>
  );
}

/* ── header primitives ──────────────────────────────────────────────── */

function OrgLogoLarge({
  logo,
  name,
}: {
  logo: string | null;
  name: string;
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl"
      style={{
        width: 108,
        height: 108,
        background:
          "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #f3f6fa 60%, #e9eef5 100%)",
        border: "1px solid #eef2f7",
      }}
    >
      <SafeImg
        src={safeImageSrc(logo) ?? undefined}
        alt=""
        className="h-full w-full object-contain p-3"
        loading="eager"
        fallback={
          <span
            className="font-heading"
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--color-text-faint)",
            }}
          >
            {initials}
          </span>
        }
      />
    </div>
  );
}

function RatingCard({
  label,
  value,
  count,
  accent,
  accentBg,
}: {
  label: string;
  value: number;
  count: number;
  accent: string;
  accentBg: string;
}) {
  const has = value > 0;
  return (
    <div
      className="rounded-xl"
      style={{
        border: "1px solid var(--color-border)",
        background: "#fff",
        padding: "10px 12px",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md"
          style={{ background: accentBg }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={accent}
            aria-hidden="true"
          >
            <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
          </svg>
        </span>
        <span
          className="font-heading truncate uppercase"
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".1em",
            color: "var(--color-text-muted)",
          }}
        >
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <b
          className="font-heading"
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--color-dark)",
            lineHeight: 1,
          }}
        >
          {has ? value.toFixed(2) : "—"}
        </b>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-faint)",
          }}
        >
          / 5 · {count} review{count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function CountCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: "linear-gradient(135deg, var(--color-dark-mid) 0%, var(--color-dark) 100%)",
        border: `1px solid ${tint}`,
      }}
    >
      <span
        className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
        style={{ background: "rgba(255,255,255,.10)", color: "#fff" }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div
          className="font-heading"
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          className="mt-1 truncate font-heading uppercase"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: ".12em",
            color: "rgba(255,255,255,.72)",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
