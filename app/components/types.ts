/**
 * Design-contract types for the public-site presentation components.
 *
 * These describe the SHAPE the restored `main`-branch design expects —
 * they are deliberately schema-agnostic. The page/query layer maps the
 * rebuild's new-schema rows into these shapes before handing them to the
 * components, so the components stay identical to their `main` originals
 * while the data underneath is the new model. (The old
 * `lib/supabase/queries.ts` that originally defined these is intentionally
 * not reintroduced.)
 */

/** Badge inputs for a review author (drives RoleBadge). */
export type ReviewAuthor = {
  user_type: string | null;
  attendee_type: string | null;
};

/** The central event-card contract used by FeaturedShowcase + EventCard. */
export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  host_club: string | null;
  location_text: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  premium: boolean;
  logo: string | null;
  owner_id?: string | null;
  host_logo?: string | null;
  general_rating: number | null;
  coach_rating?: number | null;
  attendee_rating?: number | null;
  reviews: number | null;
  coach_reviews?: number | null;
  attendee_reviews?: number | null;
  nr_teams_last_year?: number | null;
  created_at: string;
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
  event_ages?: { age: string }[];
  event_competition_levels?: { level: string }[];
  event_fields?: { surface: string }[];
  event_genders?: { gender: string }[];
};

/** Typeahead row for the header EventSearchOverlay. */
export type EventSearchRow = {
  id: string;
  title: string;
  host_club: string | null;
  location_text: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  logo: string | null;
  event_ages?: { age: string }[];
  event_genders?: { gender: string }[];
};

/** Review contract used by ReviewShowcase / ReviewCard (landing testimonials). */
export type ReviewRow = {
  id: string;
  review_title: string | null;
  review_body: string | null;
  overall_rating: number | null;
  username: string | null;
  user_role: string | null;
  guru_review: boolean | null;
  created_at: string;
  author_id?: string | null;
  events?: { title: string | null } | { title: string | null }[] | null;
  author?: ReviewAuthor | ReviewAuthor[] | null;
};
