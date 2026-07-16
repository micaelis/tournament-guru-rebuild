import type { ReviewRow } from "@/app/components/types";

/**
 * Fixed demo reviews shown on the landing page's "Recent Reviews" section.
 *
 * These are the same four reviews the Bubble export (recent-reviewed.csv)
 * shipped, mirrored by the `reviews` seed migration (000015) — but for the
 * landing page we render them from this static module so the section shows
 * the intended demo copy immediately, regardless of whether the DB seed has
 * been applied yet.
 *
 * Attendee-type / user-type assignments are pre-decided (not randomized on
 * every render) so the badges stay stable across reloads:
 *   • Jessica Martinez  → Parent / Spectator
 *   • Tyler Robinson    → Team Manager
 *   • Aiden Alvarez     → Coach  +  Guru badge
 *   • Melissa Greenberg → Parent / Spectator
 *
 * The `author` shape mirrors what `getRecentReviews` populates from the
 * `review_author_badges` view, so the RoleBadge component derives the same
 * badge it would for a real seeded author (no fallback needed).
 */

type DemoReview = Pick<
  ReviewRow,
  | "id"
  | "review_title"
  | "review_body"
  | "overall_rating"
  | "username"
  | "user_role"
  | "guru_review"
  | "created_at"
  | "author_id"
  | "events"
  | "author"
>;

export const DEMO_RECENT_REVIEWS: DemoReview[] = [
  {
    id: "demo-1753962389420",
    review_title: "Well-organized and family-friendly!",
    review_body:
      "This tournament was amazing! Great communication from the organizers, and plenty of seating for parents. My son had a blast.",
    overall_rating: 5,
    username: "Jessica Martinez",
    user_role: "Parent / Spectator",
    guru_review: false,
    created_at: "2025-04-28T18:56:00Z",
    author_id: null,
    events: { title: "Midwest All-Stars Showcase" },
    author: { user_type: "attendee", attendee_type: "parent_spectator" },
  },
  {
    id: "demo-1753962445954",
    review_title: "Competitive teams and smooth scheduling",
    review_body:
      "Very well-run event with strong teams. Scheduling was tight but fair, and everything stayed on time. Definitely bringing our team back next season.",
    overall_rating: 4.9,
    username: "Tyler Robinson",
    user_role: "Team Manager",
    guru_review: false,
    created_at: "2025-03-14T17:19:00Z",
    author_id: null,
    events: { title: "West Coast Champions Cup" },
    author: { user_type: "attendee", attendee_type: "team_manager" },
  },
  {
    id: "demo-1753962487269",
    review_title: "Best tournament I’ve played this season",
    review_body:
      "Loved the venue and the vibe. Great competition, fair refs, and amazing energy from the crowd. 10/10 would recommend!",
    overall_rating: 5,
    username: "Aiden Alvarez",
    user_role: "Coach",
    guru_review: true,
    created_at: "2025-03-19T19:09:00Z",
    author_id: null,
    events: { title: "National Youth Open" },
    author: { user_type: "attendee", attendee_type: "coach" },
  },
  {
    id: "demo-1753962575371",
    review_title: "Perfect for families!",
    review_body:
      "Very clean facilities, friendly staff, and great visibility of all fields. As a parent, I felt comfortable and involved the whole time.",
    overall_rating: 5,
    username: "Melissa Greenberg",
    user_role: "Parent / Spectator",
    guru_review: false,
    created_at: "2025-04-04T20:28:00Z",
    author_id: null,
    events: { title: "Elite Hoops Invitational" },
    author: { user_type: "attendee", attendee_type: "parent_spectator" },
  },
];
