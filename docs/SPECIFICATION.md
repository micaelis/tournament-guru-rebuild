# Tournament Guru — Software Specification

*A unified requirements & specification document for the Tournament Guru web
application (Next.js 16 App Router, React 19, Server Actions, Supabase).
This document consolidates the per-page scopes, the authoritative data model
(`SCHEMA-DESIGN.md`), and the behavior catalog (`SMOKE-TESTS.md`) into one
canonical source. Where earlier per-page notes conflicted with the schema
decisions log, the resolved rule is stated here and the old contradiction is
not surfaced.*

---

## 1. Overview

### 1.1 What the app is

Tournament Guru is a youth-sports (primarily soccer) **tournament discovery and
review platform**. It helps families, coaches, and team managers find the right
events for their teams and read verified reviews from previous attendees, while
giving the organizations that run those events a way to publish, promote, and
manage their listings. The product tagline captures the intent: *"the most
comprehensive youth sports tournament search engine — your one-stop shop to find
the right event for your team."*

The platform earns trust through **verified reviews**: coaches who actually
attended an event are invited by email (via a promo-code flow) to leave a
review that carries a visible "GURU REVIEW" / verified badge. Aggregate ratings,
category breakdowns, and a "% would return" signal are computed from these
reviews and surfaced across discovery surfaces.

### 1.2 Goals

- Let attendees **discover** events through rich search, filters, and a map, and
  read trustworthy, verified reviews.
- Let Event Directors **claim, publish, and promote** listings, gather reviews,
  and manage engagement.
- Give admins the tools to **moderate** the platform: users, reviews, flagged
  content, banned words, claim requests, and promo submissions.
- Enforce security and privacy at the database boundary (RLS + column grants),
  never relying on client checks as gates.

### 1.3 The three user types and their roles

Every account is exactly one **user type**, chosen at signup and **locked
thereafter**. Within a type, the account holds one **role title**, adjustable
during onboarding and then locked (see §4).

| User type | Role titles | Purpose |
|---|---|---|
| **Admin** | (single admin role) | Moderates the whole platform; can create events/tournaments on behalf of EDs who have no account; approves claims and promo submissions. Admins log in through the shared auth screen and are role-redirected to the admin dashboard (no impersonation mechanism). |
| **Event Director (ED)** | `event_director`, `event_admin`, `club_director` | Creates and manages tournaments and events, promotes them, gathers and replies to reviews, submits coach-email CSVs for promo sends, and claims admin-created listings. |
| **Attendee** | `coach`, `parent_spectator`, `team_manager` | Discovers events, favorites them, writes reviews (coaches via the verified promo flow), comments, and marks reviews helpful. A **Coach is a specialization of Attendee**. |

Public (anonymous) visitors are not accounts but are a first-class audience: they
can browse the landing page, search, view event and public ED pages, and read
published reviews and comments.

---

## 2. Global conventions

These conventions apply everywhere and are not repeated in each feature section.

### 2.1 Terminology

- **Organization (spelling).** Use **"organization"** (American spelling)
  throughout code, copy, and identifiers — never "organisation".
- **Organization Title / Club Affiliation.** There is **one** profile field for
  an account's organization name. It is labelled **"Organization Title"** for
  Event Directors and **"Club Affiliation"** for attendees. It is mandatory for
  all roles **except `parent_spectator`**.
- **Tournament vs Event.** A **tournament** is the parent container; **events**
  live under it. Claiming, ownership transfer, and aggregate ratings roll up to
  the tournament. A tournament can hold many events across seasons.
- **Surface.** The playing-surface field (turf / grass) is named **"surface"**
  everywhere (it was formerly "fields" / "format"). The public filter chip that
  was labelled "Format" is replaced by the **Distance** filter in the search
  subheader (see §5.2).
- **Featured Events.** The public-facing section label **"Featured Events"
  stays** (no rename). It surfaces events that are **premium OR general-ad**
  (see §2.4 and §5.1).
- **Verified / GURU review.** A published review written by a coach through the
  promo flow (`guru_review = true`). Rendered with a "GURU REVIEW" badge.
- **Coach pool vs Attendee pool.** Ratings are shown in two pools: the **Coach
  pool** = reviews written *with* a promo code (verified coaches); the
  **Attendee pool** = reviews written *without* a promo code. Both are computed
  on read.

### 2.2 UI principles

- **Selectable blocks, not dropdowns.** Wherever a user picks from a fixed choice
  set (user type, role, gender, distance, team dimensions, competition level,
  region, surface, etc.), use friendly selectable blocks/chips — **not** native
  dropdowns. **The single exception is the team Age selector (U4–U20), which
  remains a dropdown.**
- **Confirmation on destructive actions.** Deletes, cancels, blocks, declines,
  rejections, and unfollows always show a confirmation popup first and a success
  alert after.
- **Status shown as colored chips.** Every status in the app is displayed as a
  chip with its own background and font color.
- **Neutral placeholder for missing photos.** Where a user card renders without a
  profile photo, show a neutral placeholder icon (users cannot upload a photo
  during onboarding — this is intentional).
- **Reusable empty-state placeholder.** All lists share one empty-state
  component, adjusted per context, with a helpful prompt/CTA.
- **Shared auth layout.** Auth and onboarding screens share a layout: form on the
  left, sticky full-height image on the right with a glass-morphism overlay
  containing marketing copy, labels, and chips.

### 2.3 Date-derived event status

`events.lifecycle` stores only **`draft | active | canceled`**. The
date-relative statuses shown in the UI are **computed at read time** from
`start_date`/`end_date` versus the current date, so they never go stale:

- `lifecycle = draft` → **"Draft"**
- `lifecycle = canceled` → **"Canceled"**
- `active` and `end_date < today` → **"Concluded"**
- `active` and `start_date > today` → **"Upcoming"**
- `active` and `start_date ≤ today ≤ end_date` → **"Ongoing"**

This derivation is exposed through a helper (`event_display_status(events)`) and
used everywhere status is shown. When an event's dates are edited, its displayed
status recomputes automatically — no stored status to update.

### 2.4 The three event tiers (Premium, General Ads, Standard)

`is_premium` and `is_general_ad` are **two independent booleans**. An event can
be in both tiers (Premium + General Ads). Together with the default (neither
flag), they define three placement tiers:

| Tier | Flag | Public label | Placement |
|---|---|---|---|
| **Premium** | `is_premium` | "Featured" | Top of search, landing Featured section, premium fields |
| **General Ads** | `is_general_ad` | **"Spotlight"** | Horizontal-scroll section between Featured and Listings on search; sticky right column on the attendee dashboard |
| **Standard** | (neither) | "Event Listings" | Below Spotlight on search |

- **`is_premium`** ("Featured Events") unlocks the premium fields (extra images,
  video, features, teams section, milestones), places the event at the top of
  search, and lists it in the landing/public Featured section. `premium_at` is
  stamped once on the `false → true` transition.
- **`is_general_ad`** ("General Ads" internally, **"Spotlight"** publicly) places
  the event in the Spotlight horizontal-scroll section on the search page
  (between Featured and Listings) and in the attendee-dashboard Spotlight column.
  Admin-toggled; no paywall this sprint.

The public **Featured Events** section and the landing showcase draw from
**premium OR general-ad** events. The attendee-dashboard right column draws from
**general-ad** events only (max 3, shuffled each page load).

### 2.4.1 Search page tier order

Featured (Premium) at top → **Spotlight** horizontal-scroll section in the middle
(hidden if empty; sorted soonest → latest by start date) → standard Event
Listings below.

### 2.4.2 Attendee dashboard Spotlight column

A **permanent sticky right column** (max-width 270 px) on the attendee dashboard
showing up to **3** General Ads events, **shuffled randomly on each page load**.
Hidden on non-attendee dashboards and when no qualifying events exist.

**Filter:** `is_general_ad = true` AND lifecycle is not draft or canceled AND
`end_date > now − 25 days` (shows events that ended ≤ 25 days ago, ongoing, or
upcoming). Up to 10 are fetched; 3 are randomly selected per page load.

**Card fields:** event logo (image), title, date range (start – end), city +
state code, and an add-to-favourites heart button.

### 2.4.3 Admin General Ads toggle

The admin dashboard event detail page has a **General Ads on/off toggle** (like
the existing Premium upgrade). EDs cannot toggle General Ads this sprint — it is
admin-only while the paywall is off. Enforced at the DB via column grants
(authenticated cannot UPDATE `is_premium` / `is_general_ad` / `premium_at`) and
SECURITY DEFINER RPCs (`admin_set_premium`, `admin_set_general_ad`) with
`is_admin()` entry checks.

### 2.4.4 Add-on Details page — COMING SOON preview

The paid add-on flow is **not live for launch** (payments deferred), but EDs
already get its landing page as an informational preview: **Add-on Details**
(`/dashboard/events/[id]/add-ons` from an event's Upgrade CTA;
`/dashboard/add-ons` from the sidebar pointer — same page, no "Applies to"
card). One segmented toggle sells the two add-ons — **Premium Listing · $900**
and **General Ads · $300** (one-time, per event listing) — each with a dark
device/browser mock preview, a "What's included" checklist, and a sticky price
rail. The coming-soon framing is explicit and triple-stated: a "Coming soon"
pill beside the title, an amber "add-ons aren't purchasable yet" banner, and
the Activate slot rendered as a **disabled "Coming soon" stub** — no checkout,
no inquiry/contact form, no mutations of any kind. Each price rail keeps the
mockup's Stripe trust signal beneath its Activate slot: the "Powered by Stripe"
wordmark (`/stripe-logo.png`) over a lock-icon caption reading **"Payments
powered by Stripe"** — reworded from the mockup's "Secure checkout · powered by
Stripe" because no checkout exists pre-launch. The event-scoped
variant shows the source event in the rail's "Applies to" card (logo, status +
tier pills, date range) and its back link returns to that event. Entry points
(all ED-facing): the events-list row **Upgrade**, the details-page **Upgrade to
premium**, the edit-form header prompt, and the sidebar **Premium listings →
Learn more** (which flips to "You're here" on the page). Admins never route
here from those CTAs — they keep the on-behalf confirm/toggles (§2.4.3).

### 2.5 Enumerations

The canonical choice-sets are Postgres enums (see the appendix, §11, for the full
table). Key user-facing sets: user types, role titles, gender
(female/male), team gender (boys/girls/both), age brackets (U4–U20), competition
level (highest/upper/middle/lower/lowest), distance preference
(no_limit / <150 / <300 / <450 miles), regions (I–IV), field sizes (5v5–11v11),
event features, and the various status enums (event lifecycle, review status,
promo status, CSV status, claim status, flag reason).

---

## 3. Data model summary

The authoritative model lives in `SCHEMA-DESIGN.md`; this is a concise map. Every
table has a `uuid` primary key (except `profiles`, whose id equals
`auth.users.id`), `created_at`, and `updated_at` where edited. `citext` is used
for case-insensitive email/banned-word matching.

### 3.1 Identity

- **`profiles`** (1:1 with `auth.users`, auto-created by a `handle_new_user`
  trigger): `user_type` (locked), `role_title` (locked after onboarding),
  `first_name`, `last_name`, `dob` (**PII — never in a public projection**;
  under-18 blocked app-side), `user_gender`, an 8-field `location_*` block
  (lat, lng, formatted, city, state_full, state_abbr, zip, place_id),
  `distance_pref`, `organization_title`, `org_description` (ED only),
  `org_logo_url` (ED only), `profile_photo_url` (never set during onboarding),
  `blocked` (admin-set), `onboarding_completed`, and six ED / six attendee
  notification-preference booleans (**all default false**). Email lives in
  `auth.users` and is never exposed on public surfaces.
- **`user_teams`** (1:many → profiles): `slot` (1–3), `team_gender`, `age`,
  `competition_level`. Max 3 teams, or **1 for `parent_spectator`** — trigger
  enforced. All team fields are nullable (onboarding Screen 3 is optional).

### 3.2 Tournaments & events

- **`tournaments`**: `owner_id` (null/admin = claimable), `created_by`, `title`,
  `recurring` (stored no-op, informational), `claimed`, and denormalized
  aggregate ratings rolled up across child events.
- **`events`** (→ tournaments): `owner_id`, `created_by`, `claimed`, `logo_url`
  (mandatory to publish), `title`, `website_url`, `host_club`, `start_date`,
  `end_date` (both nullable for drafts; required at publish, end ≥ start),
  `registration_deadline`, `description`, the 8-field `location_*`
  block, `num_teams_this_year`, `region`, `season_id`, `lifecycle`,
  `cancel_reason`, `is_premium`, `is_general_ad`, `premium_at`, premium media
  (`video_url` ≤ 200MB, `teams_this_year_url`, `teams_prev_year_url`,
  `registration_url`, `teams_attended_prev_year`), `would_return_pct`, and
  denormalized aggregate ratings + six category averages. (Search matches by
  ILIKE over title / host club / location; the unused full-text columns were
  dropped — S10.13.)
- **Event child tables** (all cascade from `events`): `event_age_groups`
  (team_gender, age, price, field_size), `event_competition_levels`,
  `event_surfaces`, `event_features` (premium), `event_images` (≤3 free / ≤13
  premium), `event_milestones` (premium "Key Dates & Deadlines", with two
  auto-created rows), and `sponsors` (name, safe link, logo). Age/Gender search
  facets derive from `event_age_groups` — no separate facet tables.

### 3.3 Reviews & engagement

- **`reviews`** (→ events, → profiles author): `status` (`draft`/`published`),
  six category ratings (`rating_fields`, `rating_facilities`,
  `rating_management`, `rating_competition`, `rating_diversity`,
  `rating_cost_value`, each 1–5, null = excluded from averages), computed
  `overall`, `review_title`, `review_body` (rich text, server-sanitized),
  `would_return` (coach/manager only), `guru_review` (**server-set only**),
  `promo_id`, `helpful_count`, `published_at`, snapshot reviewer type/role,
  `detached`, and `snapshot_*` event fields (populated on event
  delete so a detached review still renders). One published review per
  (author, event) — partial unique index.
- **`comments`** (→ reviews, self-threaded): `parent_comment_id`, `body` (rich
  text, sanitized + banned-word checked), `is_owner_reply` (the single pinned
  ED-owner reply).
- **`review_helpful`** (unique per user × review; count derived),
  **`content_hidden`** (per-user permanent hide after flagging),
  **`flagged_content`** (content_type, content_id, flagged_by, reason,
  additional_info; grouped by content on the admin Flagged page).

### 3.4 Promo, claim, favorites, activity

- **`submitted_csvs`**: ED-uploaded coach-email files (private bucket) tied to a
  premium event; `status` (`pending`/`approved`/`rejected`), `rejection_reason`.
- **`promo_codes`** (→ submitted_csvs): one row per uploaded email —
  `email` (citext), `pretty_code` (8-char alnum, display/copy only),
  `url_token` (**nanoid, unguessable — the `?promo=` value**), `user_id`
  (linked if the account exists), `status`, `applied_at`. Partial unique: one
  non-void promo per (email, event).
- **`promo_funnel_events`**: step tracking (landed/step1/step2/step3/applied),
  collected but not surfaced in sprint 1.
- **`claim_requests`** (tournament-level): `tournament_id`, `event_id` (the one
  clicked), `requester_id`, `status`, `phone` (required), `links[]` (required),
  `message`, `decline_reason`. Unique pending per (requester, tournament).
- **`favorites`** (unique user × event), **`recently_viewed`** (unique user ×
  event, upsert latest, capped at 50).

### 3.5 Reference, admin, infra, billing

`seasons` (auto-extends yearly via a scheduled task), `us_states` (seed KS not
KA), `regions`, `banned_words` (admin CRUD, word-boundary enforced), `faqs`
(audience-scoped), `search_queries` (write-only, rate-limited 1000/min),
`support_messages`, `contact_requests` (rate-limited 60/min), `platform_counters`
(durable, never decremented), `rate_limit_windows`, `demo_reviews` (seeded
landing testimonials — never real reviews), plus deferred `cards`,
`transactions`, and `notifications` tables.

---

## 4. Authentication & Onboarding

Auth and onboarding share one layout and are guarded so users always land in the
right place. All choice selections here use selectable blocks (Age excepted).

### 4.1 Signup

- Requires **email and password**. Password must be **≥ 8 characters, with at
  least 1 uppercase letter and at least 1 digit** — signup is blocked until the
  rule is met (validated server-side; the client mirror is UX only).
- Requires a **user type** then a **role** under that type — exactly one each,
  chosen via friendly selectable blocks. **`user_type` is locked after signup**;
  thereafter only the role within the type is adjustable (and role, too, locks
  once onboarding completes — see §4.4).
- Requires **agreeing to the terms**: a checkbox "I agree to the Privacy Policy
  and Legal Terms" linking both pages (new tab). Validated **server-side** —
  without it signup returns a field error; the client `required` is UX only.
- **Already-registered email**: signup tells the user — an `email` field error
  ("An account with this email already exists. Try logging in, or reset your
  password.") with Log in / Reset password links, instead of the verify-email
  screen. Detected via Supabase's anti-enumeration signUp shape (user with an
  empty `identities` array). Signup is the **only** flow that reveals account
  existence; password reset stays generic (§4.5, DECISIONS S12.4).
- A **"Skip registration"** CTA redirects to the Search Events page.
- The header link **"Claim/List your event free"** (on the *For Event Directors*
  page) routes to signup with **Event Director pre-selected**. If a signed-in
  user clicks it, they are **logged out first**, then sent to signup (ED
  pre-selected), with a seamless transition.

### 4.2 Login and blocked accounts

- Requires email and password; password reset is available (§4.5).
- **Blocked accounts**: if the admin has blocked the account, the user is
  immediately signed out on login and cannot reach any dashboard. They see the
  popup: *"We're sorry to let you know that your account has been indefinitely
  blocked."* If a blocked user hits any non-public page (`/onboarding` or
  `/dashboard/*`), they are logged out and bounced to the landing page
  (`/login?error=blocked`).

### 4.3 Onboarding gating and redirects

- The onboarding route is **authenticated-only** (anon → rejected).
- A signed-in user who has **completed all mandatory fields** and lands on an
  auth or onboarding screen is **immediately redirected to their dashboard**.
- A signed-in user **missing ≥ 1 mandatory field** is shown **Screen 1** and
  walked through onboarding, with previously saved fields prefilled.
- The user can **log out** from onboarding → redirected to `/login`.
- The user cannot advance to a later step while a mandatory field in the current
  step is missing/invalid — "Next" is blocked and the missing field is made
  obvious.

### 4.4 Onboarding steps

A shared header persists across steps. **Attendees have 3 steps; Event Directors
have a 4th.** The completeness set that flips `onboarding_completed = true` is:
`first_name`, `last_name`, `role`, `dob`, `gender`, `location`,
`organization_title` (except `parent_spectator`), and `org_description` (ED).

**Screen 1 — Personal Information** ("Tell us a little about yourself"):
First name*, Last name*, and **Organization Name*** (labelled Organization
Title / Club Affiliation per role). All fields are required. **Role is
captured on the signup form (type-scoped) and locked once onboarding
completes.**

**Screen 2 — Location, Gender, DOB** (same "Personal Information" / "Tell us
a little about yourself" heading as Screen 1):
- **Location*** (placeholder "City, State, or Zip Code"), wired to Google Maps
  (keys already provisioned). **Mandatory.**
- **Gender*** (Female / Male) as a selection, not a dropdown. **Mandatory.**
- **Date of birth*** via the masked mm/dd/yyyy input with the in-house
  calendar popover (easy year change); hint "You must be at least 18." If the
  DOB indicates a **minor (under 18)**, show a simple warning and block
  proceeding.

> Both Gender and Location are **mandatory** (this resolves an earlier note that
> implied they were optional).

**Screen 3 — Preferred Event Criteria** (all selections optional; subtitle
"This information will make your event searching faster, easier, and more
aligned with your specific needs"):
- **Distance from your location**: No limit / <150 miles / <300 miles /
  <450 miles. The hint explains more distance = more events and links the
  **Find Events** page, where the radius can be adjusted any time.
- **Your Team's Info**: up to **3 teams** (**1 for `parent_spectator`**,
  trigger-enforced). Each team: Gender (Boys/Girls/Both), **Age (U4–U20 —
  dropdown)**, Competition Level (Highest/Upper/Middle/Lower/Lowest) — one
  selection per dimension. Team info entered here is thereafter edited **only in
  Account → Preferences** (see §7.4), not on the profile.

**Screen 4 — Organization (ED only):** Organization logo (**PNG/JPG/JPEG,
≤ 5MB** — enforced server-side by the `org-logos` bucket) and Organization
description. The logo field is the shared `ImageUploadField`: upload a file
straight to Storage OR paste a hosted URL, either way rendered through
`safeImageSrc` with a placeholder on load failure (§ uploads, DECISIONS
S10.4/S10.6).

On completion, **attendees are redirected to Search Events** and **Event
Directors to the dashboard**.

### 4.5 Password reset

- Reset uses **Supabase's default reset emails** for now.
- **Anti-enumeration**: whether or not an account exists for the submitted email,
  the user sees an **identical generic message**. The response must not reveal
  whether the email is registered. (Signup §4.1 is the deliberate, sole
  exception — DECISIONS S12.4.)
- **Rate limit**: **server-side**, 1 email per 30 seconds per requester (a second
  request within the window is rejected). This is enforced server-side, not by a
  client timer alone.

> These two rules resolve earlier per-page text that described revealing
> non-existent emails and a client-only timer.

### 4.6 Signed-in header affordance

A signed-in user can reach their dashboard from the header (avatar + name +
notifications icon with a visual indicator for new notifications). Missing
profile photos render the neutral placeholder. On the public site header the
initial-avatar itself links to `/dashboard`, which roots each role to its
landing tab.

---

## 5. Public site

The public site is anonymous-readable and is the top of the discovery funnel.
Public header nav: Home · For Attendees (Search Events, Write a Review) · For
Event Directors (Claim/List your event free, Upgrade your event listing) ·
Featured Events · About Us · Contact.

### 5.1 Landing page

- **Dynamic counters** (from durable `platform_counters`, never decremented):
  total reviews, total events listed (status ≠ Draft), total tournaments listed.
- **3 popular searches**, client-provided and **hardcoded** (not from
  `search_queries`).
- **Featured Events** — exactly **4** events drawn from **premium OR general-ad**,
  sorted soonest-first, restricted to `start_date > now − 30 days`. Each card:
  event logo, status, title, host org, host avatar, location, dates, age
  groups/brackets, description, plus two rating pools (**Coach Rating** and
  **Attendee Rating** — each with total review count and average).
- **Recent Reviews** — 4 items pulled from the seeded **`demo_reviews`** table,
  **never real reviews** (no PII in a public marketing section).

### 5.2 Search Events

- **Search fields**: event title, tournament title, event director name,
  organization title, city, state / state code, age group, competition level.
  (ED-name search never returns unclaimed events.)
- **Filter chips** in the subheader: Dates, Age, Gender, Level, **Distance**,
  States, All Filters. Any chip opens a right-side **Filter modal** with all
  selections. An applied filter is highlighted (dark background). Filters are
  clearable.
- **Distance is pre-applied** from the user's saved location + distance
  preference, added to the modal, and **quickly resettable** (it occupies the
  subheader slot where "Format" used to be).

#### Distance filter — origin and semantics

- **Tiers**: No limit / within 150 / 300 / 450 miles — the same ladder as
  onboarding Screen 3, measured great-circle (Haversine) from an origin.
- **Origin, in order of precedence**:
  1. An explicit `dist`/`lat`/`lng` in the URL always wins, including the
     `dist=any` marker the reset chip writes (that marker is what stops the
     server re-applying the saved preference on the next navigation).
  2. **Signed in with a geocoded saved location** → the profile location and
     saved `distance_pref` are pre-applied. Needs real coordinates: a
     hand-typed, never-geocoded location stores text only and is skipped.
  3. **Anon, or no saved location** → the filter modal's own location input
     (the Places autocomplete, which degrades to plain text without a Google
     key). Picking a place turns the filter on at 150 mi if no tier is set.
- **No origin set**: the tier buttons stay pickable and the modal shows
  "Pick a location above to apply the distance filter." The filter is inert
  until all three of miles/lat/lng are present — a tier alone never filters.
  (Tiers stay enabled deliberately, so a user can choose the radius before
  the location; disabling them would force one order.)
- **Intersection**: distance ANDs with every other filter — it narrows the
  faceted result set and can never widen it.
- **Events without coordinates** are excluded while distance is active, and
  listed normally when it is off. They are also simply absent from the map.
- **States facet** uses short codes (e.g. MO for Missouri); all US states.
- **Layout**: results on the left, **sticky map on the right** loading events.
  Hero with text + the 3 chip metrics.
- **Result controls bar**: "X result events", **List | Grid | Hide Map | Sort
  by**. **Featured/premium results sort near-first**; pagination; footer.
- **"% would return"** appears as a **prominent icon** on the event card, drawn
  from `would_return_pct` (all coach + team_manager reviews that answered the
  `would_return` question).

**Event card fields**: event logo, title, age group (e.g. "U9–U19"), gender,
competition level, **surface** (grass/turf), description, reviews/ratings, event
location (city + state code), dates, status, and **Add to favourites** — if not
logged in, favouriting prompts account creation first.

### 5.3 Event Details page

*(Rebuilt to match the `tgredesign` design language.)*

- **Red banner** prompting a review if the event just ended.
- **Media grid** of photos + video (premium). Since most events have only a
  logo, the grid must look good with a logo alone; if there are more photos than
  the grid shows, a functional **"Show all x photos"**.
- **Title block**: event dates (with year), title, location (city + state code),
  5-star average with score and review count, Add to favourites, and — **for
  featured events only** — **"x% would attend"** drawn from the coach/manager
  `would_return` question.
- **Sticky Host Information sidebar**: ED photo, name (clickable → public ED
  page), total received reviews, average score, total published events, **business
  phone/email/website** (from `profiles.business_*` via the `public_directors`
  definer view — never the auth email), org description, registration URL, and
  **Other Events by this host** (3–4 max). The host card pulls the owner ED's
  profile org (logo/title); the event card itself always shows `host_club`.
  The host row shows the ED's **full name** — EDs are public business
  identities (S11.8), matching `/directors` and the public ED page; the
  "First L." rule applies to attendees/reviewers only.
- **Left content**: age groups, gender, **surface**, level, teams, description,
  age groups and pricing; **Key Dates & Deadlines** (featured only — see below);
  additional features (what's included).
- **Facilities**: because events can span venues but only one address is stored,
  **display the full address and hide the designed Facilities section**.
- **Ratings / reviews section**: reviewer photo, name, role, GURU badge, average
  score, review date, title, body, **Helpful** thumbs-up with count. Filter by
  **Coach Rating | Attendee Rating**, sort by **Most Helpful | Most Recent**.
  Two pool sections (Coach, Attendee), each with average score, 5-star icons,
  review count, and a **5-row score breakdown with progress bars**; "x verified
  reviews" shown if the event is featured.
- **Sponsors**: logo, link, title.
- **Key Dates & Deadlines** (featured only, S12.48): a vertical timeline of the
  ED's entered milestones (title, date, optional description — added/edited/
  deleted in the event form, §6) plus a derived, always-present **"Tournament
  Kicks Off"** anchor row (= the event's start date; never a stored milestone).
  Rows sort by date (dateless milestones trail as TBD) and carry a
  **date-derived status badge**: past = *Done* (emerald), every milestone on the
  soonest still-to-come date = *Next up* (red-tint), later futures = *Upcoming*
  (slate), and the kick-off always reads *Event day* (solid red). The card
  renders **only when the ED entered at least one milestone** — the derived
  kick-off alone doesn't warrant it. (Historical note: the legacy app
  auto-created "Early-Bird Pricing Ends" + "Registration Deadline" rows; the
  rebuild never auto-creates milestones — `is_auto` is a dormant column.)

Every visit to this page registers the event in the viewer's **recently viewed**
list (see §7.3).

### 5.4 Public ED page

Reached by clicking an ED name anywhere it appears. **Never exposes PII or
draft/unclaimed events.**

- **Header**: organization logo, title, description; ED profile picture and
  name; two detailed rating sections (**Coach Rating | Attendee Rating** across
  this ED's published events); **# Completed Events | # Open Events**.
- **Events tab**: cards of this ED's **published** events, sortable with the same
  options as the search page. **Default sort: descending by publish date, then
  descending by paid flag** — the paid-flag key is fixed as the always-second
  sort key; the first key updates with the selected sort option.
- **Reviews tab**: the detailed rating columns plus the list of reviews with
  their comments.

### 5.5 Public Attendee page

`/attendees/[id]` — reached wherever an attendee's avatar or name appears
(review cards, comments, the ED dashboard's reviewer avatar and popup). The
attendee's own Account tab links here ("View public profile").

- **Public name rule**: first name + last initial — "Ashley M.". Identity
  comes only from the `public_attendees` SECURITY DEFINER view, which computes
  `last_initial` and **never exposes `last_name`** (or email/DOB). Deleted,
  blocked, or not-yet-onboarded users → 404.
- **Header**: profile picture, public name, city + state code, role, total
  published reviews, club affiliation.
- **Two metric blocks** — "Reviews as Verified Coach" | "Reviews as Attendee":
  5 stars prefilled with the average score the user has GIVEN in that capacity,
  the value as e.g. "2.33/5", and the count as "12 reviews" (capacity split:
  `reviewer_role = 'coach'` vs the rest, same as director ratings).
- **Review list**: only PUBLISHED, non-hidden reviews, via the shared review
  card — comments module, helpful, flag, GURU badge on verified reviews, an
  event-context chip per card — plus a Verified Coach / Attendee filter.

### 5.6 Privacy Policy and Legal pages

`/privacy` ("Privacy Policy") and `/terms` (titled **"Legal"** per its own
copy; the route name is historical) render client-provided legal copy
**verbatim** — structure only (headings, bullet lists) via the shared
`LegalArticle` long-form layout. Never rewrite or "improve" the copy in code;
changes come from the client as new source texts. Both pages are linked from
the footer bottom bar (Privacy · Legal).

---

## 6. Event Director dashboard

**Dashboard shell (all roles):** an ink sidebar (per-item icons, red
active-indicator bar, thin slate-blue scrollbar) plus a sticky top header —
breadcrumb (*Dashboard › section*) on the left and the signed-in user
(avatar, name, role) on the right. Clicking the user opens the account menu:
name + login email, **Account**, and **Log out** (returns to `/login`).
Session actions live ONLY in that menu — the sidebar carries navigation and
role context, never sign-out. The sidebar's bottom slot is role-scoped: EDs
get a **Premium listings** pointer (its **Learn more** opens the coming-soon
**Add-on Details** page, §2.4.4; on that page the link flips to a "You're
here" state) and their
**organization card** (logo + title); attendees get a **club card** when a
club affiliation is set; admins get neither. Below that, every role gets the
**legal footer row** — Privacy · Legal · Cookies, labels mirroring the public
site footer.

Sidebar (order per `app/dashboard/nav-items.ts`): Events · Reviews · Claim
Requests · Promo Codes · Search Events · Transactions* · Add-on Pricing* ·
Notifications* · Account · FAQ · Support. Items marked * are **hidden this
sprint** (Transactions, Add-on Pricing, Notifications). The default landing
page is **Events**.

### 6.1 Events

**Empty state** ("Welcome, [first-name]"): the subtitle, three numbered info
blocks (01 Create Your Event / 02 Promote Your Event / 03 Get benefits from this
promotion), an embedded YouTube video
(`https://www.youtube.com/embed/DRx5FdXORwY?si=zR5vmdYVlvYUHp4P`), and an
**"Add New Tournament"** CTA.

**Create tournament** (popup): **Tournament Title*** (mandatory) and a
**Recurring** toggle (**stored no-op**, informational only). Buttons: Cancel |
Add Tournament. After creating, the ED is prompted to add the first event; if
they decline, the placeholder is replaced by the tournaments list. Deleting a
tournament first shows: *"Are you sure you want to delete this tournament? This
action is permanent and will also delete all the events within this
tournament."* — and cascades (see §9.3 for the review/comment retention
exception).

**Page layout**: a header row — the **Events** title (admin: "All events") with
a quiet counts line (**N tournaments · N events · N verified reviews**), a
one-line subtext, and the **New tournament** CTA pinned top-right — over a slim
white toolbar card holding the pill search box (search tournaments by title), the
sort control (**Creation Date / Average rating / Reviews count**, each
**ascending or descending**; Title A–Z is the default), and the **status tabs**
(All / Published / Drafts / Concluded / Canceled; Published = Upcoming +
Ongoing). Search, sort and status all ride URL params. An active status filter
hides tournaments that have no events; a tournament whose events all fail the
filter keeps its card with a *"No events match this filter."* line.

**Tournament cards**: one soft-shadow white card per tournament — a TOURNAMENT
eyebrow, the title + **Recurring** tag, then one compact meta line (**N events ·
★ average · N verified reviews · "Ratings breakdown"** toggle, collapsed by
default, plus a Show/Hide events toggle; admins also see the owner name or
**Unclaimed** here). Tournament-level actions pack right as white ink-outlined
buttons: **Add event** and **Edit tournament**. **Deleting a tournament lives
inside the Edit dialog** (same cascade warning + confirm as before). Empty
tournaments show a dashed placeholder tile prompting to add the first event.

**Ratings breakdown** (tournament-level AND per-event; collapsed by default;
rendered only with **≥ 1 review**, with an ✕ to close): one composition at both
levels — the three audience averages up top (**Overall**; **Coach**, red, on
premium surfaces only; **Attendee**, amber), each a large 2-decimal value +
stars with its pool line beneath, then the six category averages (Fields,
Facilities, Management, Competition, Diversity, Cost/Value) as tiles under a
**BY CATEGORY** eyebrow. On premium surfaces a seventh tile, **Coach
Experience**, shows the would-attend-again percentage as a meter (matching the
internal event-details summary band) — never stars. The Coach pool = verified
coach reviews; the Attendee pool = non-verified.

**Event create/edit form.** `*` = mandatory to publish; `[]` = accepts a list.
Mandatory-to-publish fields: **Event logo** (**PNG/JPG/JPEG, ≤10MB** — no SVG;
enforced server-side by the `event-images` bucket, S10.4), Event title, Event
Website URL, Host Club, Starting Date, Ending Date, Event Description, Event
Location, **Level of Competition []** (≥1), Event Region (I–IV), **Surface []**
(Turf/Grass, one or both), and **Season** (2021-2022 … 2028-2029; the set
auto-extends yearly). Non-mandatory: Registration Deadline, Number of teams
this year, **Age Groups []** (each requires Gender, **Age (U4–U20 dropdown)**,
Price with a `$` prefix, Field Size 5v5–11v11 — add/edit/delete anytime),
**Sponsors []** (each requires Name, Link, Logo — add/edit/delete anytime),
and **Event Images** (≤ 3 free).

**Form layout (S12.46).** The form is a LEFT-aligned ~880px column of flat
white section cards, each led by an icon section header (38px slate medallion +
tight title/subtitle) whose right-side slot carries that section's "Add X" CTA,
count chip ("3 divisions", "2 / 3 used"), or Premium tag. Section order: **The
basics** (logo as a 132px square tile with Upload + clear under it and the
paste-a-URL input preserved; title; website; host club; description) → **Dates
& registration** (start / end / registration deadline) → **Location & season** →
**Competition** (number of teams this year moved here, then levels + surfaces
as check-marked red-tint pills) → **Age groups** → **Sponsors** → premium
sections (§ below) → **Photos**. Age groups and sponsors edit inside ONE
bordered container with row dividers (no per-row boxes); **age-group gender is
picked with single-select choice chips (Boys / Girls / Both)** — same
`team_gender` values as the old dropdown — while age + field size stay compact
selects. Photos render as a gallery of uniform square tiles with X-on-hover
plus a dashed "Add photo" tile; a newly added (empty) slot edits through the
full `ImageUploadField` row until its value lands.

- **Event logo, sponsor logos, and event images** use the shared
  `ImageUploadField`: upload a PNG/JPG straight to the `event-images` bucket OR
  paste a hosted URL, either way rendered through `safeImageSrc` with a
  placeholder on load failure (DECISIONS S10.4/S10.6). The event logo uses the
  `layout="tile"` variant; its empty tile is the calm slate picture-glyph
  placeholder, never the red Avatar-style initials (S12.46).
- **Website inputs** show a link-icon container; numeric inputs show a `#` icon
  container; the location input a pin — leading-icon containers are the form's
  shared input language.
- **Date fields** (start / end / registration deadline / key-date milestones) are the
  masked mm/dd/yyyy inputs with the in-house **calendar popover** (S12.22): a LEADING
  calendar glyph at the head of the input (S12.46) opens a month grid to pick from;
  typing the date stays fully supported and the native browser picker is never used.
- **Free image cap = 3.** On a saved non-premium event the edit form leads with an
  **upgrade prompt in the form header** (red-tinted band, white spark disc, red
  "Upgrade this event" CTA — S12.18/S12.46); the images section notes the free-tier
  cap when it's hit. For EDs the CTA opens the coming-soon **Add-on Details**
  preview (§2.4.4); for admins it opens the on-behalf upgrade confirm, and
  upgrading (Stripe deferred — see §10) reveals the **premium sections**,
  scrolls to them, and shows a popup confirming the event is now premium and will
  appear in top searches. Premium adds three form sections (each a flat card with
  the solid-red Premium tag in its header — S12.47): **Extras unlocked** (this-year
  teams URL, previous-year teams URL, registration URL, teams-attended-previous-
  year, and **Event Video** ≤ 200MB, direct-to-storage, rendered first in the
  media grid, scaling around images), **Additional features** — selectable icon
  TILES over the same list (Stay to Play, Restrooms, Concessions, Accessible,
  Free Wifi, Pet Friendly, Free Parking, Synthetic Turf) — and **Key dates &
  deadlines** (below). Premium also raises the image cap (**Event Images**: 10
  more, 13 total, no upgrade placeholder).
- **Key dates & deadlines are PREMIUM-only (S12.47).** The milestones editor
  (rows of date + title + optional description) renders only for premium events,
  and the save action ignores milestone writes for non-premium events — a free
  event's save persists no milestones regardless of the client payload (app-layer
  guard over the replace-all RPC; no schema change). When any milestone exists,
  the editor pins a READ-ONLY **"Tournament Kicks Off"** anchor row marked
  *Required* — it is the event's **start date**, derived for display, never a
  stored milestone or a new validation rule; it anchors the public timeline.

**Save vs Publish.** **Draft** requires only the title and is visible only on
the ED's own dashboard (RLS: draft = creator-only). **Publish** requires all
mandatory fields with valid types and **end date ≥ start date**. Sponsor rows
follow the same split: they are validated (complete + safe URLs) only when
publishing or updating a live event — a draft saves in-progress rows as-is,
and all-blank scaffold rows (an untouched "+ Add sponsor") are dropped, never
validated, never saved (DECISIONS S12.5). On creation the
event is assigned to the tournament under which it was initiated, dates are
stored so search filters work, and status derives from the dates (§2.3).
Temporary age-groups/sponsors/milestones added and deleted in the same session
are not persisted. On success — draft, publish, or update alike — redirect to the
**internal event details page** with a confirmation toast ("Draft saved" /
"Event published" / "Changes saved"); the user is never left silently on the
form.

**Internal event details page** (`/dashboard/events/[id]`) — the ED's/admin's
management surface for one listing. **Hero**: event logo (red-crest initials
fallback), "Hosted by" org, status pill + Premium/Spotlight badges (admins also
get the General-Ads toggle), title, a dates · venue · season · registration-
deadline meta row (upcoming events add a "starts in N days" note), and a "View
public page" link. The hero's **action column**: Edit event (primary),
Duplicate, a Share menu (Copy public link for everyone; View/Download QR
PNG+PDF admin-only — the QR route itself is admin-gated), "Upgrade to premium"
on free events (EDs → the coming-soon **Add-on Details** preview, §2.4.4;
admins → the on-behalf confirm), and the red-tinted **Cancel event / Delete**
danger pair
(existing dialogs; deleting from this page returns to the events list).
**Summary band** (dark): overall / coach / attendee ratings, would-return %,
price range (derived from age-group prices) and this-year teams; with zero
reviews the rating zone becomes a review-invite block (copies the public link)
while the price + teams facts remain. **Sections**, each with an Edit link into
the editor: About & key info (description, season, region, website,
registration deadline, competition levels, surfaces, premium features), Age
groups & pricing (per-division cards, per-team prices), Key dates & deadlines
(premium + ≥1 ED milestone — the same shared timeline as the public page,
§5.3/S12.48, with the milestone count and "shown on your public page" in the
header), Media (premium only:
video link-out + photo gallery with an "Add photos" slot tile), Sponsors
(logo + domain + Visit), and Reviews (overall + the 6-category strip; the full
shared reviews component is a later unification). **Right rail**: Location
(venue + Open in Google Maps) and the Listing record (Published/Draft/Canceled,
created + last-modified dates, copyable event ID). A canceled event shows its
public cancel reason in a banner under the hero. While the save
runs, only the clicked button shows the "Saving…" spinner — the sibling submit
button merely disables. A save is **atomic**: the base
row and every child collection (age groups, sponsors, competition levels,
surfaces, features, images, milestones) persist through one transactional RPC
(`save_event_graph`), so a failed save leaves the event exactly as it was — no
half-written or half-wiped collections.

**Editing.** A **draft** offers Delete, **Update** (title-only mandatory), and
**Update & Publish** (all mandatory); drafts can be upgraded to premium without
ever publishing. A **published** event offers Update (even when Concluded),
Delete, and **Cancel** — cancel requires a **mandatory, character-capped
reason** shown publicly on the event page. Missing-field feedback scrolls to the
field with info text.

**Events table under each tournament**: collapsible (admins start collapsed),
**paginated when > 10**, sorted by **start date soonest-first**. Columns:
**Event** (logo, title, Premium/Spotlight pills, host club), **Status**,
**Dates** (compact range + a relative hint + the **Season** chip beneath), and
**Reviews & rating** (5-star icons in **0.5 steps**, the 2-decimal average, the
verified count, and the per-event **"Breakdown"** toggle). Location is not a
column — it lives on the details page. **Clicking a row opens the internal
event details page** (`/dashboard/events/[id]`). Premium rows carry the red
accent spine + warm wash; **Canceled** rows gray out their identity cell. Row
actions in fixed order: a solid-red **Upgrade** (only on non-premium
draft/upcoming/ongoing events — for EDs it opens the coming-soon **Add-on
Details** preview, §2.4.4; for admins it opens the on-behalf premium-upgrade
confirm), **Edit** (every status except Canceled
— **Concluded events stay editable**), and the **"…" overflow**: Duplicate,
Copy public link, Copy spectator reviews link (the public review-writing URL),
admin-only QR, then Cancel event (upcoming/ongoing only) and Delete.
**Duplicate** clones config only (no reviews/comments; premium **not** carried
over). Copies confirm with a toast.

**Admin differences** on the Events page (see also §8): search by title **and
owner full name**; an extra **Owner** sort key; **CSV export** of exactly the
on-screen results (enabled only when there is data); tournament/event editing
gated (add tournament / add event only if admin-created and unclaimed; **editing
an event is always allowed**); events collapsed by default; the tournament meta
line names the **owner** (or **Unclaimed**) and each row's **Premium** pill
carries the premium flag; and the **QR generator** (400×400 PNG or PDF of the
public URL, in the row's "…" overflow and the details page's Share menu, with a
download-confirmation toast).

### 6.2 Reviews

**Who can write a review:** attendee-type users only (Coach, Team Manager,
Parent/Spectator), non-blocked. **Event Directors and Admins cannot write
reviews** — enforced in RLS, not just the UI. One review per user per event.

**Replies:** the **owner ED** may reply to reviews on their own events (one
pinned reply per review). **Admins** may reply to any review. Both may
edit/delete their own replies. **Admins** may edit or delete any review
(moderation).

**Guru/verified badge:** promo-coach-only, **restricted to paid events**
(Premium or General Ads). The `apply_promo_to_review` RPC rejects promos on
non-paid events.

Accessible to **ED and Admin**. The ED sees reviews on **their own events**; the
admin sees **all**.

- **Controls**: search by user name; **filter by event** (checkbox multi-select
  modal with its own search — ED sees only their events); **filter by review
  type** (With Promo Code / Without Promo Code); **clear all**. A shared empty
  placeholder shows when there are no results.
- **Location filter** (also on My Reviews, §7.1): a multi-select of the state
  codes the reviews cover, with per-state counts; disabled if none. Admin sees
  all states with reviews (never empty states); ED sees only their own.
- **Reviews table**: paginated **30/page**; every column sortable asc/desc;
  **default sort = descending by creation date**. Columns: Username (avatar +
  full name), Host Club (reviewer org), Event (title → public page), the six
  category averages + **Overall Score** (average across rated categories), and
  Date. Null-scored categories are excluded from averages. Username depth
  follows RLS like the reviewer popup: admins get the full name via profiles;
  EDs get the first name + org + photo backfilled from `review_author_public`
  (never last name). Name search matches whatever depth the caller sees.
- Under each row, the **review itself**: title, body, likes count, comments
  count, and reviewer role chips. If the reviewer is a **Coach with an applied
  promo**, the role chip also shows the **8-character pretty code**. Verified
  promo reviews carry the badge.
- **ED reply**: exactly **one** reply per review; can be edited, deleted, and
  re-added (popup with the review details at top); shows body + date. On events
  the ED does **not** own, the **admin** may reply. Admins may **delete reviews
  and replies** here (and delete comments on the public page). **Drafts are
  creator-only** (read + edit).
- **ED flag-review** popup: *"Please select one of the reasons below why you
  would like to flag this review for."* — one required selection from
  **Profanity / Illicit material / Solicitation / Other**, plus an
  additional-info text area (**required when "Other"**). Confirm creates a
  `flagged_content` record and shows *"Thank you! The Admin will be notified
  about the flagged review."*; the card shows it was flagged by this ED with the
  provided info.
- **Admin edit/delete review** popup (event card at top): edit review title,
  description, and all six category ratings; save shows a confirmation alert.
- **CSV export** (ED + Admin): per-row checkboxes plus a header bulk-select;
  "Export x reviews" appears only when ≥1 is selected; max **30 per page**.
  Fields include review body, reviewer org, the six category ratings, event
  title, has-promo-code, overall rating, team 1/2/3 (age, gender, competition
  level), review title, **reviewer email (admin-only)**, user role, user name,
  and review creation date. Download shows a confirmation alert.
- **Reviewer detail popup** (click Username): profile (photo, full name, city +
  state code, org name, published-review count), team info rows, and two rating
  columns — **Reviews as Verified Coach** (with-promo pool, **red** accents) and
  **Reviews as Attendee** (without-promo pool, **yellow** accents), each with a
  5-star average, `x.00/5`, and count. Pools are computed on read. Identity
  depth follows RLS: admins see the full profile + teams; EDs see what the
  public `review_author_public` view exposes (first name, org, photo) with the
  rest rendered as "—" — no grant is widened for this popup.

**The review form** (also used on the public event page and the promo-review
flow):

- A non-selectable legend: *"Rate your experience from 1-5 stars"* with
  1★ Not Good / 2★ Could Be Better / 3★ Average / 4★ Good / 5★ Great (the legend
  stars are **not** clickable).
- Six **selectable** category rows, each with helper text: **Fields**,
  **Facilities**, **Tournament Management**, **Competition**,
  **Diversity/Variety**, **Cost/Value**.
- **Review title** and **review body** (rich text with bold/italic/strike/
  underline/list/link and, if possible, emoji). Body is capped at **400
  characters** with a **live remaining-character counter**.
- **Banned-word check** (word-boundary, admin-managed list): if the title or
  body contains a banned word, block posting and **show the offending words** so
  the user can amend.
- **`would_return`** question, **required for Coach and Team Manager** reviewers
  (not `parent_spectator`).
- **Publish validation** and exact copy:
  - all six ratings required → *"* To submit your review, please select a rating
    for all the categories above."*
  - title required → *"* To submit your review, please include a title."*
  - body over limit → *"* You have exceeded the 400 character limit."*
- **One review per event** (`unique(author_id, event_id)` where author not
  null); the flow creates, upgrades a draft, upgrades a non-verified review, or
  is blocked if a verified review already exists.
- If the reviewer is a coach with a promo, publishing sets **`guru_review =
  true`** (server-set) → the review renders with **"GURU REVIEW"** and stands
  out; the promo → **Applied** with a timestamp. On multiple promos for one
  event, the reviewer chooses which promo to apply (the rest → void). A confirm
  popup precedes publishing; a success alert follows.
- **Edit window**: the reviewer may edit only **within 30 days after the event
  end date**; after that, editing is blocked with a clear reason, and a **soft
  nudge** about the window appears on the Reviews page.

**Comments & engagement:**

- Attendees **except the review's author** may comment or flag a review
  (author self-comment → rejected). Comment threading is Facebook-style
  (vertical reply lines), sorted **newest-first**, paginated when **> 10**. The
  comment text area obeys the same rich-text + banned-word rules as the body.
- The **owner ED's** comment is a single **pinned, highlighted reply** shown at
  the top, rendered with the org logo/name (name → public ED page).
- **ED/Admin cannot comment on each other's concluded events — only attendees.**
  Admins may still delete.
- Comment creators may edit/delete their own comments anytime.
- **Helpful** is a thumbs-up toggle (one per user per review; remembered and
  un-selectable), feeding a counter used in later public-facing logic.
- On score change, all dependent aggregates recompute (event + tournament,
  NULL-aware — see §9.4).
- **Reviewer self-delete** fully deletes the review + its comments + flags (an
  exception to the retention rule), **but the platform review counter is not
  decremented** (deleted reviews still count).

### 6.3 Promo Codes

Both ED and Admin have this page. **Admin tabs**: Submitted CSVs, Coaches with
promo codes. **ED tabs**: My Submitted CSVs, Coaches with promo codes, Submit
CSV file.

**Status labels.** The underlying CSV status `approved` is labelled **"Sent
Promo Code"** on the admin view and **"Sent emails"** on the ED view. Rejected
cards are grayed out.

**Submitted CSVs (admin).** A sub-tab chip row (admin only): **All | Pending |
Sent Promo Code | Rejected** (the last three map to pending / approved /
rejected). Table columns: **Event Director** (avatar + name → public ED page),
**Event** (logo + title → internal event page), **CSV File** (download icon +
filename; download shows an alert), **Submitted** (date), and per-row actions.

- **Pending** rows offer **Reject** or **Send Emails**. **Approved** rows show
  **Sent** with a **Resend emails** CTA.
- **Reject**: confirm + typed **reason** (visible on both dashboards) → delete
  the CSV rows, keep the master entry as **Rejected**, show a success alert.
- **Send Emails** popup: "Send Promo Codes", the event card, the note *"A unique
  promo code will be sent by email to the recipients below. If the recipient is
  not a member of the platform, they will be sent a link to register as a
  Coach."*, an "Uploaded Emails (x)" chip, and the row list. Each row: index,
  email, an exclude checkbox (individual or bulk). Rows whose email belongs to a
  **non-coach account** show *"This email is already in use by an account with a
  different user type and will be ignored."*, are grayed out, and are **not
  re-addable**. Manually-excluded rows are grayed but **re-addable**. CTA:
  **Cancel | Send x emails**.
- On send: the CSV status becomes **approved**; rejected/ignored rows are
  deleted. For each remaining row, generate and store the **8-character pretty
  code** and the nanoid `url_token`. If a **non-blocked coach account** exists
  for the email → status **Active** and the promo is **linked to that user**
  (visible on the attendee dashboard); otherwise → status **Sent** (Account chip
  = Invited). Both cases send a **SendGrid** email (template `d-…`, title
  *"Submit Your Review on Your Recent Tournament Experience"*, params: event
  title + link URL pointing to the promo-review auth variant with
  `?promo=<url_token>`).
- **Batch limit.** Sends are queued/batched (background queue) to avoid rate
  limits. **⚠ CONFLICT TO CONFIRM: the CSV row cap.** The send-logic text says
  "100 rows/file" while the Submit-CSV infotip says "1000 rows/file". The
  **intended value is 1000** (per SCHEMA/BUILD); the infotip and validation
  should agree on 1000 — **confirm before locking**.
- **Resend** reuses the popup with adjusted copy and shows a copyable
  `?promo=<token>` link per row.

**Submitted CSVs (ED).** All of this ED's submissions, **newest-first**, one
list, no status separation. Columns: Event (logo + title → internal page), CSV
File, Submitted date, and a **Status** chip (Pending | Sent emails | Rejected +
reason). **Pending** submissions can be **cancelled** by the ED.

**Coaches with promo codes.** Admin columns: Coach (photo, name, email — or
placeholders if no linked account), **From** (the submitting ED), Event,
**Account** (Registered if a user is linked, else Invited), **Promo Code**
(pretty code chip), **Status** (promo status), and **See Review** (popup with the
full review + rating stats, event card at top, reviewer shown for admin). ED
columns are the same **minus reviewer identity**.

**Submit CSV file (ED only).** A CSV uploader, an infotip (*"Once submitted, your
CSV file will be reviewed by the Admin. Please download the demo CSV… Limit of
1000 rows per file."*), and a **Download demo CSV** (one column titled **`email`**
— clean syntax, must map to the DB — with two sample rows). The **CSV header must
be `email`**. After a valid upload, the ED must **select a premium/targeted-ads
event** (mandatory to proceed); if none exists, they are prompted to upload a
first premium event or upgrade an existing one. On success: *"Your file has been
successfully submitted to the Admin and will be reviewed shortly"* and return to
Submitted CSVs; the submission is visible to the admin.

**Promo status lifecycle** (see also §9.6): **Pending** (ED submitted, awaiting
admin) → **Sent** (approved, no account) / **Active** (approved, coach account
exists) → **Applied** (review submitted with the promo) · **Rejected** (admin
declined) · **Void** (sibling promos voided when another is applied). One
non-void promo per (email, event).

### 6.4 Claim Requests (ED)

Mirrors the admin claim table (§8.6) but **hides the User column**. The ED submits
claims from public event cards; see §9.7 for the full claim/ownership-transfer
model, including the claim modal (required phone, required links, optional info),
the "Requested" unclickable state, and the logged-out → ED auth variant.

### 6.5 Account (ED)

Tabs: Profile, Security, Preferences, Notifications, Payment Methods. See §7.4
for the shared Account behaviors (Security, Preferences, Notifications, deletion,
and the profile preview card). The **ED Profile** is a split-section settings
card — **Identity** (photo, first name, last name, location, gender),
**Organization** (title, description, logo — the logo uploader shows a fixed
square tile), and **Public contact** (business phone/email/website) — with the
same mandatory rules as onboarding. (Role remains locked post-onboarding.)

### 6.6 Support

A form with **Email** and **Full name** (both autopopulated) and a **Message**
(capped ~2000 chars, rate-limited). Submitting sends an email to
**support@tournamentguru.com** — *"You have a message from: <name>, <email>"*
followed by the message in italics — and shows a confirmation popup.

### 6.7 FAQ (shared: ED + attendee)

`/dashboard/faq` renders the published + visible entries whose audience
matches the signed-in user (`faq_audiences`: user_type + optional
role_title), grouped as a designed help page (S12.43):

- **Header**: "FAQ" + two HeaderCountChip pills — `N answers` (visible
  entries) and `N topics` (non-empty topic sections) — both derived from
  the live audience-filtered data; a "Contact support" ink-outline
  secondary top-right smooth-scrolls to the support card.
- **Topics** are presentational: the schema has no topic column, so
  entries bucket into four canonical sections (Getting started ·
  Reviews & ratings · Events & claiming · Account & privacy) by
  title-keyword derivation (`lib/faq/topics.ts`, `deriveFaqTopic`);
  unmatched titles land in Getting started and empty topics never
  render. Each section: icon-badge header + one card of divided
  expand/collapse rows (chevron disc fills ink when open; answers sit
  at a ~620px measure). Rows whose title mentions Guru or claiming
  ship pre-expanded.
- **Search** (a card with jump-to-topic anchor chips): `/` focuses it;
  typing filters live — matches auto-expand, empty topics hide, a meta
  line counts results, zero results shows the shared EmptyState with a
  Clear-search action.
- **Support card** at the end links the red Contact-support CTA to
  §6.6's form. (The mockup's "or email …" line is dropped: the address
  is env-configurable — `SUPPORT_EMAIL_TO` — so hardcoding it in UI
  could misstate prod.)

---

## 7. Attendee dashboard

Sidebar (order per `app/dashboard/nav-items.ts`): Search Events · My Reviews ·
Promo Codes · Favorites · Activity · Notifications* (hidden) · Account · FAQ ·
Support. Sign-out is in the header user menu (see the §6 shell).

### 7.1 My Reviews

The attendee's version of the Reviews list (§6.2), redesigned as the
approved my-reviews mockup (S12.44):

- **Header**: "My Reviews" + HeaderCountChip pills — `N reviews`,
  `N published`, and `N drafts` (the drafts pill is **hidden at 0** —
  drafts are private, "0 drafts" is noise; the published pill hides only
  when there are no reviews at all) — over a one-line page subtext.
- **Toolbar row** under the header: the **location multi-select** left,
  the **sort control** right (icon + native select in the approved
  control chrome). Sort by: Newest, Oldest, Best-to-worst,
  Worst-to-best (by overall across the six categories); default
  **Newest**.
- **Location filter**: a dropdown trigger ("Location" + pin; the
  selected count rides it as a red bubble) opening a **checkbox menu**
  of states — full state name + this user's **published**-review count
  per state, A→Z; draft-only states get no row; the control hides when
  no state derives. Checking states filters the whole list (drafts
  included) to those states; empty selection = all; "Clear selection"
  resets. State comes from the **live events join** (snapshots are only
  stamped at event-deletion detach, so detached rows fall back to the
  snapshot location's trailing state code). Derivation is the pure
  `deriveLocationChips` in `lib/reviews/shared.ts`.
- **Each card is one cohesive container**: a header band (event crest
  via SafeImg, title link, host · city, state · event dates + the
  **status pill** — Published emerald / Draft sky — and, on verified
  rows, the solid-red **Guru Review** badge), a rating hero (stars +
  big score + review date), review title/body, a tinted **category
  ratings panel** (six white tiles with 5-star icons), and a slate
  footer band. All dates render mm/dd/yyyy (`"en-US"`).
- **Footer stats are never a bare "0"**: published cards show
  `N found this helpful` / `N comments` with icon discs, zeroes read as
  words ("No helpful votes yet" / "No comments yet"); a **draft**'s
  footer instead reads "Only you can see this draft" + "Publish window
  closes <mm/dd/yyyy>" (end + 30 days; "closed" once past).
- Card actions are **icon buttons with a background tint**: pencil =
  Edit (slate), trash = Delete (red, confirm dialog — allowed any time;
  deletion cascades the review's comments). Save/publish from the write
  form confirms via the success toast ("Draft saved…" / "Your review
  has been published").
- The 30-day edit window applies: past it the Edit button renders
  **disabled with the dark tooltip** — "Editing locked · Reviews lock a
  month after the event ends."
- A verified **Guru review wears the accent treatment**: red spine +
  red-tinted border + warm header wash (Guru = red).
- If the **owner ED commented** on the review, that comment shows here; other
  comments open in a popup on click.
- Empty state: the shared gold-tone EmptyState (floating star disc, red
  pencil badge) with a red **Browse events** CTA → Search Events and a
  "How verified reviews work" text link → FAQ.

### 7.2 Favorites

Subtitle: *"Events you've saved, all in one place — so they're easy to find
when it's time to plan."* Listed **newest-favorited first**. Each card has **Unfollow Event**
and **Visit Event Page**. Unfollow confirms first: *"Are you sure you want to
unfollow this event? You will no longer receive update notifications from this
event."* → removes it. Favouriting anywhere **requires an account** — anon users
are prompted to create one.

### 7.3 Activity

*"A trail of the events you've viewed lately — newest first."* Recently-viewed
events as a **vertical timeline**: one rail down the left with day checkpoints
(`Today · <date>`, `Yesterday · <date>`, `Earlier`), a node per entry —
the newest is the accent-red dot (soft ping halo, motion-gated) — and per-entry
relative + exact view times beside the rail (collapsing into the card below
`sm`). Each entry is a white card, fully clickable to the public event page:
logo, **de-suffixed title** (a trailing "— U12 Girls"-style division marker is
stripped; the demographics render instead as **age-group + gender chips**,
`both`/mixed → *Coed*), host club · location, an event-dates chip (*"Ended …"*
muted once past), favourite/unfavourite heart, chevron. The rail fades out
after the last entry, followed by the cap note *"Your last 50 viewed events
are kept here."* **Browse events** (page header + empty state) wears the
public red primary pill. Each public event-page visit registers the event; the
list is **capped at 50** (upsert latest).

### 7.4 Account (shared behaviors)

**Attendee tabs**: Personal Information, Security, Preferences, Notifications,
Promo Codes. **Admin tabs**: Profile, Security only (admin profile = photo,
first name, last name).

**Profile preview card** (beside the profile form, sticky on wide screens):
avatar, name, role eyebrow, then role-scoped facts — organization/club,
location, member-since, and (ED) website. **An empty fact never disappears**:
it renders as an *"Add your …"* placeholder that scrolls to and focuses the
matching form input. Non-admins also get a **profile-completeness meter**
(percent of the role's profile fields filled, with a hint naming what's
missing); **at 100% the meter disappears** — no bar, no percentage — replaced
by a quiet "Profile complete" note with a next-step link (ED → *Add an event*,
attendee → *Find your next event*). Attendees get the **View public profile**
link here (it moved out of the form). Every profile input carries placeholder
text so empty fields are never blank boxes. The profile photo previews as a
**circle** (matching how it renders everywhere), and DOB shows as a labelled
read-only field (lock icon, "never shown publicly" hint).

> **Saves are partial.** Because the three roles render different field
> sets inside one form, `updateProfile` writes only the columns whose
> inputs were actually submitted — an unrendered field is left untouched
> rather than nulled. A rendered-but-emptied field still clears. Same
> rule for notification prefs, keyed off each row's `section:` marker
> (see S8.7).

> **Save confirmations ride the global toast.** Profile, Password,
> Preferences, and Notifications saves fire the success toast (S12.25);
> errors stay inline. The email-change flow keeps its inline alert — a
> stays-on-screen instruction (check both inboxes), not a completed save.

- **Attendee Profile** shows: photo, name, city, state code, **DOB** (with a
  subtext noting *it is not displayed anywhere*), gender, role type, and org name
  (Club Affiliation); a team-info placeholder when none; and three counts
  (**x Reviews | x Comments | x Favorited**). Editable: photo, first name, last
  name, location, org name, gender, and the coach/parent question. **Role is
  locked post-onboarding**; **team info is edited in Preferences, not here.**
- **Security** (all types): one card, two label-column sections — **Login email**
  (current address with a *Verified* badge once confirmed) and **Password**
  (show/hide toggle + requirement pills mirroring the server policy). **Email
  changes are two-step** (S12.12): Supabase mails confirmation links to both the
  current and the new address; the action rejects an invalid or unchanged
  address, and every mailed link lands on the dedicated `/email-change` screen
  (partial → done → error states, AUTH-SCREENS §7), never on the homepage. A
  **password update triggers an email confirmation first** (and, per the
  security-review gate, re-authentication before the change). EDs and Attendees
  can **delete their account** after a password-confirmed popup; the card and
  dialog copy state the §9.3 true-delete consequences **per role** in plain
  language (ED: reviews + comments permanently deleted, created
  events/tournaments removed, claimed-only listings returned for re-claim;
  attendee: reviews + comments permanently deleted — the rating recompute
  still happens but is an internal detail the copy no longer narrates).
- **Preferences** (Attendee/ED): travel-distance choice chips + **team
  information** (the single home for team editing) — per team: Age dropdown (the
  one allowed select), gender + competition-level **choice chips**; unused slots
  collapse into an "Add a … team" affordance.
- **Notifications** (Attendee/ED): a **switch matrix** — one row per section
  with **In-App + Email** switch columns, **defaults off**. Attendee sections:
  **Review Replies, Review Likes, Comment Replies**. ED adds: **Event Reviews,
  Favorited Events**. Saves are partial per the `section:` marker rule, and the
  switches always reflect the **saved** state after submit (S12.10).
- **Attendee Promo Codes**: a table of this user's promos — **Code** (pretty code
  chip), **Code status**, **Event** (logo + title → public page), **From** (the
  submitting ED), **Review Status** (Draft/Published). If the user already
  published a review with the promo, show their average and a popup with the full
  review (edit if the time window allows); if not and the window permits, prompt
  **write a review** (opens the review popup). Publishing a **Draft** applies the
  promo. **No duplicate promo per (user, event).**

---

## 8. Admin dashboard

Sidebar (order per `app/dashboard/nav-items.ts`): Events · Reviews · Flagged ·
Banned Words · FAQs · Users · Claim Requests · Promo Codes · Support Messages ·
Search Events · Account. Sign-out is in the header user menu (see the §6
shell). Admin Events, Reviews, and
Promo Codes are covered in §6 (with their admin-only differences); this section
covers the admin-specific pages. Admins reach their dashboard through the shared
auth screen via role-based redirect.

### 8.1 Events (admin differences)

See §6.1: title + owner-name search, an Owner sort key, on-screen-only CSV
export, gated tournament/event editing, collapsed lists, owner named on the
tournament meta line + the per-row Premium pill, and QR generation (400×400
PNG/PDF).

### 8.2 Reviews (admin differences)

See §6.2: admin sees all reviews, may edit/delete reviews and replies, may reply
on unowned events, and reviewer email appears in the CSV export (admin-only).

### 8.3 Users

Two tabs: **Attendees (x) | Event Directors (x)**.

- **Search** (server-side, per tab): one field matching name, organization
  title, or **email**. Email matching resolves through the admin-only
  `admin_search_users_by_email` RPC (emails live in `auth.users`; the RPC
  returns matching ids only, never the addresses), and the ids fold into the
  same profiles filter as the name/organization match.

- **Attendees** columns: Name (photo, name, email), Location (full saved
  address), Gender, DOB, Joined (creation date), Type (attendee role), Reviews
  Published.
- **Event Directors** columns: Name, Organization Title, Joined, Type (ED role),
  Total Events (published), Premium Events (upgraded to paid).
- A three-dot action per row reveals **Block User** and **Delete User**, each
  behind a confirm popup and followed by a success alert. Blocked users cannot
  access their dashboard and see the account-unavailable popup (§4.2). Deleting a
  user removes all removable linked data (reviews/comments deleted — §9.3).

### 8.4 Banned Words

Simple **CRUD** of banned words. Enforcement is **functional and server-side**,
**word-boundary** matched, blocking reviews and comments that contain any listed
word (with disclosure of the offending words — §6.2).

### 8.5 Flagged Content

Admin-only, two tabs: **Reviews** and **Comments**, each **grouped by review** and
sorted **descending by creation date**.

- **Flagged Reviews** columns: Reported User (review creator — photo, name),
  Review (title), Event (logo + title → clickable), **# of flags**, and
  **Dismiss | Delete**.
- **Dismiss** (after confirm): remove the flag from the review, delete this
  review's `flagged_content` entries, and drop the review from the Flagged list —
  **the review content stays**.
- **Delete** (after confirm): recompute dependent aggregates, delete the review's
  comments, delete all linked `flagged_content` entries, and delete the review
  itself (see §9.4 for recalc).
- **Expandable detail**: review title, body, publish date, and a submissions
  table — **Flagged by** (photo, name), **Creation Date**, **Reason**, **Comment**.
- **Flagged Comments** mirrors the above with columns Reported User, Comment body,
  Review title, and # of flags, and the same flows.

*(Backlog: email the creator of a deleted flagged review/comment; a repeat-offender
flag in the admin dashboard.)*

### 8.6 Claim Requests (admin)

The full model is in §9.7. Table columns: **User** (photo, name, email), Created
Date, Event (logo + title → clickable), **Status** (Pending | Declined |
Approved), and **Decline | Approve**. Decline requires a typed reason and shows a
success alert; Approve confirms, transfers ownership of the event + tournament +
siblings to the requesting ED, and **auto-rejects all other pending claims** on
that event. Admins can filter by status and search by event title / org title.
Each card is expandable to show phone, links, message, and decline reason.

### 8.7 Promo Codes (admin)

See §6.3 for the admin tabs, sub-tabs, status labels, send/reject flows, and the
Coaches-with-promo table.

### 8.8 Support Messages (admin)

Read-only listing of messages submitted through the dashboard support form
(`/dashboard/support`). Columns: **Sender** (name + email), **Message** (truncated
with expand/collapse for long messages), **Type / Role** (user type + role title
pill), **Date** (creation date). Sorted newest-first. Accessible only to admins
(RLS: `p_support_admin`).

---

## 9. Cross-cutting rules

### 9.1 Permissions / RLS model

RLS is the **security boundary**; client-side role checks are **UX affordances
only** (they hide buttons or change copy, never gate data).

- **RLS on every table**, split into `USING` (row visibility) and `WITH CHECK`
  (written values).
- **Column-grant allow-lists** cap privilege escalation (Postgres checks column
  privileges before RLS): sensitive columns are **not client-writable** —
  `user_type`, `role_title` (after onboarding), `blocked`, `guru_review`,
  `published_at`, `promo_id`, and the platform counters. Anything that must write
  these goes through a **SECURITY DEFINER RPC** or the service role in a server
  action. Every SECURITY DEFINER function pins `search_path`.
- **Draft reviews and draft events are creator-only.** Published reviews/comments
  and published events are public-readable.
- **Public ED page and public event page never expose PII or draft/unclaimed
  events.** Public projections of locked tables use definer views/RPCs scoped
  tightly (never returning contact email).
- Specific negatives that must be rejected: signup-as-admin, self-PATCH to admin,
  unauthorized calls to destructive RPCs (`delete_event`, `delete_tournament`,
  `soft_delete_attendee`, etc.), guru-badge forgery via `apply_promo_to_review` on a
  promo/review that isn't the caller's, and anon reads of reviewer email or
  `profiles.dob`.

### 9.2 PII handling

- **`dob` and email are PII** and never appear in any public projection.
- `dob` is stored but "not displayed anywhere" (noted in the profile UI).
- Reviewer email appears only in the **admin** CSV export, never the ED's.
- Under-18 DOBs are blocked at onboarding.

### 9.3 Deletion

Reviews survive an EVENT's deletion (detach + snapshot) but not their AUTHOR's:
deleting an account is a **true delete + recompute** (Option B — supersedes the
earlier anonymize-and-retain model; the `anonymized` column is gone). Deletions
are handled by atomic SECURITY DEFINER routines:

- **Event delete** = **detach + snapshot**: null the review's `event_id`, set
  `detached = true`, populate the review's `snapshot_*` fields (event title,
  tournament title, dates, location, logo) so it still renders, delete the
  event's child data, and **keep reviewer identity**.
- **Tournament delete** cascades to child events and their child data, but
  reviews/comments/replies are **retained (detached)** per the exception above.
- **Attendee account delete** = **true delete**: remove the user's review and
  comment **rows** (comment threads under a deleted review fall to the FK
  cascade, moderation rows to the purge triggers), and the reviews delete
  trigger **recomputes the affected events' scores**. The profile is scrubbed
  (PII nulled, `blocked = true`) and `auth.users` stays (§S6.1 follow-up
  unchanged).
- **ED account delete** = mixed cascade: **delete their reviews + comments** the
  same way; **delete events they originally created** (→ other authors' reviews
  detached + snapshotted); for **claimed** events, **revert `owner_id` to
  admin** so admins can manage them again — only events the ED published
  **after claiming** are deleted.
- **Reviewer self-delete of a review** fully removes the review + its comments +
  flags — same semantics as the account path.
- **The platform review counter is never decremented** by any deletion
  (§9.5) — it is a durable "reviews ever published" figure.

### 9.4 Ratings recomputation

A `recalc_ratings` trigger fires on review insert/update/delete and, from
**PUBLISHED reviews only** and **NULL-aware** (null-scored categories excluded):
recomputes the event's denormalized general/coach/attendee ratings, the six
category averages, and **`would_return_pct`** (from all coach + team_manager
reviews that answered `would_return`), then **rolls up to the parent tournament**
aggregates. It runs as SECURITY DEFINER because the author role lacks UPDATE on
events/tournaments.

### 9.5 Platform counters

`platform_counters` are **durable**: incremented on review publish and on
tournament/event create, and **never decremented on delete**. Deleted reviews
still count toward the landing-page totals. `get_platform_stats` reads them.

### 9.6 Promo lifecycle

A single atomic RPC governs promo application: on publish-with-promo it sets
`guru_review = true`, moves the promo to **Applied** with a timestamp, **voids
sibling promos** for the same (reviewer, event), and triggers recalc. The
one-review-per-event resolution (create / upgrade draft / upgrade non-verified /
block if a verified review exists) is enforced here. The **`url_token` is a
nanoid** (the `?promo=` value); the **8-character `pretty_code` is display/copy
only**. The account-existence signal (Registered / Invited chip) is separate from
the engagement status, derived from whether a `user_id` is linked. Promo funnel
steps (landed/step1/step2/step3/applied) are tracked but not surfaced in sprint 1.

**The promo-review auth flow** (the second auth variant, reachable by anon or
signed-in users at `?promo=<url_token>`):

- Missing or invalid promo → a **placeholder** on the left, no form.
- A signed-in, onboarding-complete user with a valid promo → **redirect to the
  promo's event page** (keeping `?promo`).
- **Step 1** (Email, First Name, Last Name, Organization — autopopulated):
  Continue validates, then resolves the account — logged-in → save to profile;
  an account exists for the email → log them in and save; onboarding complete →
  redirect to the event; no account → **create an Attendee with role Coach**.
- **Steps 2 & 3**: the same location/gender/age and team (up to 3) steps as
  onboarding.

### 9.7 Claim / ownership-transfer model

Admins can create tournaments and events **on behalf of EDs who have no account**;
these are **unclaimed** and show a **"Claim"** CTA on the public event card to
**both anon and signed-in** users.

- **Anon** clicking Claim → the **ED auth variant** (shared login page, glass
  overlay titled *"Become Part of the Largest and Growing Soccer Community"* with
  its subtitle; switching to Signup auto-selects **Event Director**).
- **Signed-in ED with an existing pending claim** on the event → CTA reads
  **"Requested"** and is unclickable.
- **Signed-in ED, no pending claim** → the **claim modal** ("Request Authorised
  Access"): **required phone**, **required links** (safe-URL + format validated
  when shown), **optional additional info**. Submit sends the request to the
  admin, shows a confirmation alert, and flips the CTA to "Requested".
- **Unique pending per (requester, tournament)**; CTA state
  (Claimable/Requested/Claimed) is **consistent across all sibling events** of a
  tournament.
- **Admin approval** transfers the whole **tournament + all sibling events** to
  the requesting ED, **auto-rejects other pending claims** (auto reason), and
  replaces the Claim CTA everywhere with the owner's **org logo + title**, updating
  fields accordingly. **Decline** requires a reason (admin-typed, or an
  auto-reason when another claim was approved).

### 9.8 Rate limiting

Two layers on every unauthenticated write endpoint:

- **App layer**: a per-IP fixed-window limiter (`lib/rate-limit.ts`).
- **DB layer**: a `rate_limit_touch(bucket, limit)` SECURITY DEFINER function via
  before-insert triggers — **`search_queries` 1000/min**, **`contact_requests`
  60/min**, and the **password-reset** bucket (server-side, 1 per 30s per
  requester — §4.5).

Any new public write endpoint must be gated at **both** layers.

### 9.9 Email delivery (SendGrid)

Transactional email is sent via **SendGrid from server actions** (not Edge
Functions). Uses: the **promo-review invite** (template `d-…`, title *"Submit Your
Review on Your Recent Tournament Experience"*, params event title + `?promo=`
link), the **support** message to support@tournamentguru.com, and password-reset
(Supabase default emails for now). **Bulk promo sends** run through the
**background queue** rather than inline server actions.

### 9.10 File storage

- **Event and organization images** live in **public buckets**; all DB-sourced
  URLs render through `safeExternalUrl` / `safeImageSrc` (scheme allow-list).
- **Uploaded promo CSVs** live in the **private `promo-csv` bucket** (RLS: owner +
  admin, `public=false`, ≤2MB text/csv), with **signed-URL download only** (S10.4).
- Event video uploads (premium) stay a pasted URL for now (not yet a bucket).
- **Image buckets** (S10.4), keyed by uploader id (`<uid>/<file>`), server-side
  type/size enforced: `event-images` (public, PNG/JPG/JPEG, ≤10MB — event + sponsor
  logos, gallery) and `org-logos` (public, PNG/JPG/JPEG, ≤5MB — org logos, profile
  photos). **No SVG** (it can carry script). Every image field is the shared
  `ImageUploadField` (upload or paste-a-URL; S10.6).

### 9.11 Safe URLs

Any DB string that reaches an `<a href>`, `<img src>`, `window.open`, or `fetch`
must pass through `safeExternalUrl` / `safeImageSrc`, which whitelist the scheme
(`http:`, `https:`, `mailto:`, `tel:` for anchors; `http:`, `https:` for images)
so a hostile `javascript:` / `data:text/html` URL cannot become stored XSS. This
applies to event website URLs, sponsor links, claim-request links, and org logos.

---

## 10. Deferred / future scope

Explicitly **not built this sprint**, but modeled or flagged so they can be added
without rework:

- **Stripe / payments.** The upgrade-to-premium paywall stays **disabled** (the
  client is the only ED managing events at launch). ED-facing Upgrade CTAs
  route to the coming-soon **Add-on Details** preview (§2.4.4) instead of a
  checkout; the admin on-behalf flip just reveals the premium section. The
  `cards` and `transactions` tables are stubbed (Stripe tokens/metadata only —
  never PAN/CVV; RLS owner-only). Payment Methods and Add-on Pricing UIs are
  parked.
- **Notifications delivery.** The `notifications` table and the six per-user
  preference toggles exist, but no in-app/email notification delivery is built
  (defaults off). Only the key transactional emails ship this sprint.
- **Google Places / map.** Location autocomplete is wired to Google Maps; the
  full map behavior on search is present but multi-venue facilities modeling is
  deferred (full address shown, Facilities section hidden).
- **Real background queue.** Bulk promo sends are queued/batched; a production-grade
  job runner is the target (the queue is stubbed now).
- **Hidden ED items**: Transactions, Add-on Pricing, and Notifications
  are hidden this sprint. **FAQ** is now live: admin CRUD at
  `/dashboard/faqs` (status, visibility toggle, type→role audience chips);
  attendee + ED dashboards at `/dashboard/faq` (audience-filtered, the
  designed help page — see §6.7); public `/faq` shows all
  published+visible entries.
- **Recurring tournaments.** The `recurring` toggle is a stored no-op —
  informational only; the feature was never finalized with the client.
- **Backlog items**: an ED email when the admin approves/rejects a submitted CSV;
  an email to the creator of a deleted flagged review/comment; a repeat-offender
  flag in the admin dashboard; **admin MFA**; and consolidation/contextualization
  of the three auth variants (standard, ED-claim, promo-review).

---

## 11. Appendix: enum / status reference

### 11.1 Enumerations

| Enum | Values |
|---|---|
| `user_type` | `admin`, `event_director`, `attendee` |
| `role_title` | `event_director`, `event_admin`, `club_director`, `coach`, `parent_spectator`, `team_manager` |
| `user_gender` | `female`, `male` |
| `team_gender` | `boys`, `girls`, `both` |
| `age_bracket` | `U4` … `U20` (17 values) |
| `competition_level` | `highest`, `upper`, `middle`, `lower`, `lowest` |
| `distance_pref` | `no_limit`, `miles_150`, `miles_300`, `miles_450` |
| `event_lifecycle` | `draft`, `active`, `canceled` (Upcoming / Ongoing / Concluded are **derived** — §2.3) |
| `surface` | `turf`, `grass` |
| `event_region` | `I`, `II`, `III`, `IV` |
| `field_size` | `5v5`, `6v6`, `7v7`, `8v8`, `9v9`, `10v10`, `11v11` |
| `event_feature` | `stay_to_play`, `restrooms`, `concessions`, `accessible`, `free_wifi`, `pet_friendly`, `free_parking`, `synthetic_turf` |
| `review_status` | `draft`, `published` |
| `promo_status` | `staged`, `sent`, `active`, `applied`, `void` |
| `csv_status` | `pending`, `approved`, `rejected` |
| `claim_status` | `pending`, `approved`, `declined` |
| `flag_content_type` | `review`, `comment` |
| `flag_reason` | `profanity`, `illicit`, `solicitation`, `other` |
| ~~`faq_audience`~~ | removed — replaced by `faq_audiences` child table |

### 11.2 User-facing status labels

| Context | Stored | Displayed |
|---|---|---|
| Event (derived) | `draft` | Draft |
| Event (derived) | `canceled` | Canceled |
| Event (derived) | `active`, ended | Concluded |
| Event (derived) | `active`, future start | Upcoming |
| Event (derived) | `active`, in progress | Ongoing |
| Promo | `staged` | (internal) |
| Promo | `sent` | Sent |
| Promo | `active` | Active |
| Promo | `applied` | Applied |
| Promo | `void` | (voided sibling) |
| CSV (admin) | `pending` / `approved` / `rejected` | Pending / **Sent Promo Code** / Rejected |
| CSV (ED) | `pending` / `approved` / `rejected` | Pending / **Sent emails** / Rejected |
| Promo Account chip | `user_id` set / null | Registered / Invited |
| Claim | `pending` / `approved` / `declined` | Pending / Approved / Declined |

### 11.3 Key thresholds

| Rule | Value |
|---|---|
| Password | ≥ 8 chars, ≥ 1 uppercase, ≥ 1 digit |
| Password reset rate limit | 1 / 30s (server-side) |
| `search_queries` rate limit | 1000 / min |
| `contact_requests` rate limit | 60 / min |
| Teams per attendee | 3 (1 for `parent_spectator`) |
| Free event images | 3 |
| Premium event images | 13 total (10 additional) |
| Event video max | 200 MB |
| Org / event logo | PNG/JPG/JPEG (+ SVG for event logo), ≤ 5 MB |
| Review body | 400 characters |
| Support message | ~2000 characters |
| Review edit window | 30 days after event end |
| Reviews per page | 30 |
| Events per tournament before pagination | 10 |
| Recently-viewed cap | 50 |
| Featured Events on landing | 4 (start > now − 30 days) |
| Attendee-dashboard Spotlight column | 3 max (general-ad, end_date > now − 25 d, shuffled) |
| Landing Recent Reviews (demo) | 4 |
| Featured Events window | start_date > now − 30 days |
| CSV rows per file | **1000** (⚠ confirm — see §6.3) |
| Pretty promo code | 8 chars, alphanumeric (display only) |
| Promo URL token | nanoid (`?promo=` value) |

---

*End of specification.*
