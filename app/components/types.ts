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

/** Sort options for the search page. "recommended" is an alias for "teams". */
export type EventSort = "recommended" | "date" | "rating" | "teams";

/** Facet value sets that populate the search filter drawer. */
export type EventFacets = {
  ages: string[];
  genders: string[];
  levels: string[];
  surfaces: string[];
  states: string[];
};

/** Event-detail row: the card contract plus the detail-only extras. */
export type EventDetailRow = EventRow & {
  event_director: string | null;
  event_profile_id: string | null;
  registration_deadline: string | null;
  website: string | null;
  this_year_website: string | null;
  previous_year_website: string | null;
  registration_link: string | null;
  qr_code: string | null;
  photos: string[] | null;
  updated_at: string | null;
};

/** Age-group / pricing tier for the event's Key Facts card. */
export type EventAgeGroupRow = {
  id: string;
  age: string | null;
  gender: string | null;
  label: string | null;
  price: number | null;
  age_index: number | null;
};

/** Sponsor row for the event page sponsors card. */
export type SponsorRow = {
  id: string;
  name: string | null;
  logo: string | null;
  link: string | null;
};

/** Aggregated public host/director summary (event host card + ED page). */
export type DirectorProfile = {
  id: string;
  display_name: string;
  org_logo: string | null;
  org_description: string | null;
  club_affiliation: string | null;
  profile_picture: string | null;
  guru_badge: boolean;
  completed_events: number;
  open_events: number;
  total_events: number;
  coach_rating: number;
  coach_reviews: number;
  attendee_rating: number;
  attendee_reviews: number;
};

/** Parent tournament summary (event detail fallback header). */
export type EventProfileSummary = {
  id: string;
  title: string;
  reviews: number;
  general_rating: number;
};

/** A director card in the About "Meet our team" directory. */
export type EventDirectorRow = {
  id: string;
  display_name: string;
  profile_picture: string | null;
  org_logo: string | null;
  club_affiliation: string | null;
  event_count: number;
  total_reviews: number;
  avg_rating: number;
};

/** Paged directory result for the About page. */
export type EventDirectorsPage = {
  data: EventDirectorRow[];
  total: number;
  source: "rpc" | "unavailable";
};

/** Public director review row (ED page reviews tab). */
export type DirectorReviewRow = {
  id: string;
  review_title: string | null;
  review_body: string | null;
  overall_rating: number | null;
  username: string | null;
  user_role: string | null;
  guru_review: boolean | null;
  created_at: string;
  event_id: string | null;
  event_title: string | null;
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
