# Tournament Guru — From-Scratch Schema Design (Entity Map)

Version 0.1 — for review before SQL generation.
This is the **data model**, not the DDL. Validate the structure + answer the open
questions (§9), then I generate `schema.sql` from this exactly.

Conventions: every table has `id uuid pk default gen_random_uuid()` (except `profiles`
whose id = `auth.users.id`), `created_at timestamptz not null default now()`, and
`updated_at timestamptz` where edited (maintained by a `touch_updated_at` trigger).
All choice-sets are Postgres **enums** unless noted. "→" = foreign key.

---

## 1. Enums

```
user_type          : admin | event_director | attendee
role_title         : event_director | event_admin | club_director | coach | parent_spectator | team_manager
user_gender        : female | male
team_gender        : boys | girls | both
age_bracket        : U4 … U20   (17 values)
competition_level  : highest | upper | middle | lower | lowest
distance_pref      : no_limit | miles_150 | miles_300 | miles_450
event_lifecycle    : draft | active | canceled          (upcoming/ongoing/concluded are DERIVED, see §4)
surface            : turf | grass                        (renamed from "fields")
event_region       : I | II | III | IV
field_size         : 5v5 | 6v6 | 7v7 | 8v8 | 9v9 | 10v10 | 11v11
event_feature      : stay_to_play | restrooms | concessions | accessible | free_wifi | pet_friendly | free_parking | synthetic_turf
review_status      : draft | published
promo_status       : staged | sent | active | applied | void
csv_status         : pending | approved | rejected
claim_status       : pending | approved | declined
flag_content_type  : review | comment
flag_reason        : profanity | illicit | solicitation | other
(faq_audience enum was removed — audience is now in faq_audiences child table)
```

---

## 2. Identity

### profiles  (1:1 with auth.users; auto-created by `handle_new_user` trigger)
| Field | Type | Notes |
|---|---|---|
| id | uuid pk | = auth.users.id |
| user_type | user_type | LOCKED after signup |
| role_title | role_title | must match user_type; locked after onboarding completes |
| first_name, last_name | text | mandatory (onboarding) |
| dob | date | mandatory; under-18 blocked app-side; **PII, never in public projection** |
| user_gender | user_gender null | optional |
| location_* | lat float8, lng float8, formatted text, city text, state_full text, state_abbr char(2), zip text, place_id text | all optional; state_abbr+state_full both stored so "NY"↔"New York" match |
| distance_pref | distance_pref null | optional |
| organization_title | text null | mandatory for all roles EXCEPT parent_spectator. Label: "Organization Title" (ED) / "Club Affiliation" (attendee) |
| org_description | text null | ED only |
| org_logo_url | text null | ED only, optional |
| profile_photo_url | text null | never set during onboarding; placeholder if null |
| blocked | bool not null default false | admin-set |
| onboarding_completed | bool not null default false | drives auth redirects |
| email_review_replies, inapp_review_replies, email_review_likes, inapp_review_likes, email_comment_replies, inapp_comment_replies | bool | attendee notif prefs, **default false** |
| email_event_reviews, inapp_event_reviews, email_favorited_events, inapp_favorited_events | bool | ED notif prefs, **default false** |
| business_phone, business_email, business_website | text null | ED public contact info; exposed via `public_directors` view. **Never** the auth email. |

> **Public projection views are read-only.** `public_directors`,
> `public_event_owners`, `public_comment_authors`, and
> `review_author_public` carry no RLS and run as their owner
> (`security_invoker = false`), so a write grant on one bypasses RLS into
> the base table. `anon`/`authenticated` hold SELECT only — enforced by
> migration 20260718000008 and guarded by `h1-public-views` (see S8.5).
> A newly added view starts out writable via 000005's default
> privileges; add it to that probe's `PUBLIC_VIEWS` list.

Notes: spelling is **organization** everywhere (not organisation). `user_email` lives in
auth.users; where a public surface needs it, it does NOT get exposed (PII rule).

### user_teams  (1:many → profiles; max 3, or 1 for parent_spectator — enforced by trigger)
| Field | Type | Notes |
|---|---|---|
| profile_id | uuid → profiles | |
| slot | smallint | 1..3 |
| team_gender | team_gender null | Boys/Girls/Both |
| age | age_bracket null | U4–U20 |
| competition_level | competition_level null | |
| | | unique(profile_id, slot); all fields nullable (Screen 3 optional) |

---

## 3. Tournaments & Events

### tournaments  (was "event_profiles")
| Field | Type | Notes |
|---|---|---|
| owner_id | uuid → profiles null | null/admin = claimable |
| created_by | uuid → profiles | admin or ED who created it |
| title | text not null | |
| recurring | bool default false | **stored no-op** (informational; mark in code) |
| claimed | bool default false | |
| agg ratings | general_rating, coach_rating, attendee_rating numeric(3,2); review_count int; per-category avgs (fields, facilities, management, competition, diversity, cost_value) numeric(3,2) | denormalized across child events; maintained by recalc trigger |

### events  (→ tournaments)
| Field | Type | Notes |
|---|---|---|
| tournament_id | uuid → tournaments | assigned at creation |
| owner_id | uuid → profiles null | inherits/claims with tournament |
| created_by | uuid → profiles | |
| claimed | bool default false | |
| logo_url | text | mandatory to publish |
| title | text | |
| website_url | text | render via safeExternalUrl |
| host_club | text | |
| start_date, end_date | date | nullable for drafts; required at publish (server validation); end ≥ start CHECK passes when null |
| registration_deadline | date null | |
| description | text | |
| location_* | (same 8 fields as profiles) | state used in search/facets |
| num_teams_this_year | int null | |
| region | event_region | |
| season_id | uuid → seasons | |
| lifecycle | event_lifecycle default draft | draft/active/canceled; upcoming/ongoing/concluded DERIVED from dates (§4) |
| cancel_reason | text null | capped; shown publicly when canceled |
| is_premium | bool default false | unlocks fields + top-of-search + landing "Premium Events" |
| is_general_ad | bool default false | "General Ads" (public label "Spotlight"); places event in Spotlight search section + attendee-dashboard column; admin-toggled |
| premium_at | timestamptz null | stamped on false→true only |
| video_url | text null | premium; max 200MB (direct-to-storage upload) |
| teams_this_year_url, teams_prev_year_url, registration_url | text null | premium "Teams" section |
| teams_attended_prev_year | int null | premium |
| would_return_pct | numeric(5,2) null | NEW — % of verified coaches who said they'd return (from review.would_return); shown on featured cards |
| agg ratings | general_rating, coach_rating, attendee_rating numeric(3,2); review_count int; 6 per-category avgs | denormalized; recalc trigger |
| search_document | text | expanded coded values (state, region) for "NY"↔"New York" |
| search_vector | tsvector | GIN full-text + GIN trgm on search_document |

**Event child tables** (all → events, cascade):
- **event_age_groups**: team_gender, age (age_bracket), price int, field_size — ED-managed list.
- **event_competition_levels**: level (competition_level) — multi.
- **event_surfaces**: surface (turf/grass) — multi.
- **event_features**: feature (event_feature) — premium multi-select.
- **event_images**: url, sort_order — up to 3 free / 13 premium (enforced app-side).
- **event_milestones** (NEW, Key Dates & Deadlines, premium): milestone_date, title, description null, sort_order, is_auto bool (the 2 auto-created: Early-Bird Ends, Registration Deadline; editable/deletable).
- **sponsors**: name, link (safe-url), logo_url.

Facets (Age, Gender filters on search) are derived from `event_age_groups` (distinct) —
no separate ages/genders tables needed.

---

## 4. Event status derivation (important)

`lifecycle` stores only **draft | active | canceled**. The date-based statuses shown in
the UI — **Upcoming / Ongoing / Concluded** — are **computed at read time** from
start/end vs `current_date`, so they never go stale as time passes:
- lifecycle = draft → "Draft"
- lifecycle = canceled → "Canceled"
- lifecycle = active + end_date < today → "Concluded"
- active + start_date > today → "Upcoming"
- active + start_date ≤ today ≤ end_date → "Ongoing"

Exposed via a generated column or a `SELECT` helper (`event_display_status(events)`), used everywhere status shows.

---

## 5. Reviews & engagement

### reviews  (→ events; → profiles author)
| Field | Type | Notes |
|---|---|---|
| event_id | uuid → events null | nulled on event delete (detach) |
| author_id | uuid → profiles null | nulled on account-delete anonymize |
| status | review_status default draft | draft = creator-only (RLS) |
| rating_fields, rating_facilities, rating_management, rating_competition, rating_diversity, rating_cost_value | smallint null | 1..5 each; null = not counted in averages |
| overall | numeric(3,2) | computed avg of non-null categories |
| review_title | text | |
| review_body | text | **rich text, server-sanitized** (allow-list) |
| would_return | bool null | NEW question, coach/manager reviews; feeds event.would_return_pct |
| guru_review | bool default false | **server-set only** (promo apply); verified/GURU badge |
| promo_id | uuid → promo_codes null | the applied promo |
| helpful_count | int default 0 | denormalized from review_helpful |
| published_at | timestamptz null | |
| reviewer_user_type, reviewer_role | snapshot enums | kept even after anonymize (for coach/attendee pools) |
| anonymized | bool default false | account-deleted author → display "Former member" |
| detached | bool default false | event deleted |
| snapshot_* | event_title, tournament_title, event_dates, event_location, event_logo | populated on event delete so review renders standalone |

Rules: one published review per (author, event) — partial unique index. Draft excluded
from all ED/admin/public lists (RLS). Column-level grant allow-list (no user-write of
guru_review/published/promo_id). `user_email`-equivalent PII never exposed to anon.
**INSERT policy:** attendee-type + non-blocked only (EDs and admins blocked at RLS).
**Guru/verified:** `apply_promo_to_review` rejects non-paid events (requires
`is_premium` or `is_general_ad`).

### comments  (→ reviews; self-threaded)
| Field | Type | Notes |
|---|---|---|
| review_id | uuid → reviews | |
| author_id | uuid → profiles null | nulled on anonymize |
| parent_comment_id | uuid → comments null | threading (Facebook-style) |
| body | text | rich text, server-sanitized + banned-word checked |
| is_owner_reply | bool | ED-owner comment: pinned, highlighted, shows org logo/name; limited to 1 |
| anonymized | bool default false | |

### review_helpful  (user × review)  — unique(user_id, review_id); count derived
### content_hidden  (user × content) — user_id, content_type (review|comment), content_id; per-user permanent hide after flagging
### flagged_content  — content_type, content_id, flagged_by → profiles, reason (flag_reason), additional_info text (required if reason=other). Grouped by content for admin Flagged page (Dismiss / Delete).

Both moderation tables are **polymorphic** (content_type + content_id), so no FK/cascade
is possible. Cleanup is enforced at the DB: `purge_moderation_rows()` (SECURITY DEFINER,
EXECUTE revoked) runs via AFTER DELETE triggers on `reviews` and `comments`
(migration `20260718000009`), so every delete path — direct, admin, or FK-cascaded
(review → comments, comment → child replies) — purges both tables. App code does no
per-path cleanup. Probe: `tests/probes/flag-orphans.test.ts` (S8.10).

---

## 6. Promo system

### submitted_csvs  (master; → profiles ED, → events)
| Field | Type | Notes |
|---|---|---|
| ed_id | uuid → profiles | |
| event_id | uuid → events | the premium event chosen |
| file_path | text | **private Supabase bucket**; signed-URL download only |
| status | csv_status default pending | display: approved → "Sent Promo Code"(admin)/"Sent emails"(ED) |
| rejection_reason | text null | |

### promo_codes  (→ submitted_csvs; each uploaded row is a promo record)
| Field | Type | Notes |
|---|---|---|
| submitted_csv_id | uuid → submitted_csvs | |
| event_id | uuid → events | |
| email | citext | recipient |
| pretty_code | text | 8-char alnum, display/copy only |
| url_token | text unique | nanoid, unguessable — the ?promo= token |
| user_id | uuid → profiles null | linked if account exists (Account chip = Registered/Invited derives from this) |
| status | promo_status default staged | staged→sent→active→applied→void |
| applied_at | timestamptz null | |
| | | partial unique: one non-void promo per (email, event) |

### promo_funnel_events  (tracking; collected, not surfaced sprint 1)
promo_id → promo_codes, step text (landed|step1|step2|step3|applied), occurred_at.

---

## 7. Claim, Favorites, Activity

### claim_requests  (tournament-level)
| Field | Type | Notes |
|---|---|---|
| tournament_id | uuid → tournaments | approval transfers whole tournament + sibling events |
| event_id | uuid → events | the event the ED clicked |
| requester_id | uuid → profiles | ED |
| status | claim_status default pending | |
| phone | text | required |
| links | text[] | required; safe-url + format validated when shown |
| message | text null | optional |
| decline_reason | text null | admin reason OR auto ("another claim approved") |
| | | unique pending per (requester, tournament); CTA state (Claimable/Requested/Claimed) consistent across all events in a tournament |

### favorites  (user × event) — unique(user_id, event_id)
### recently_viewed  (user × event) — unique(user_id, event_id), viewed_at (upsert latest); Activity page

---

## 8. Reference, admin, infra, billing

- **seasons**: label (e.g. "2028-2029"), start_year int, sort. **Auto-extends** yearly via scheduled task (no manual admin input) — not a hardcoded enum.
- **us_states**: code char(2) pk, name. (seed KS not KA)
- **regions**: numeral (I–IV), label — reference for search expansion.
- **banned_words**: word citext unique, created_by → profiles. Admin CRUD; server-side enforced, word-boundary match.
- **faqs**: title, content, status (draft/published), is_visible, sort_order, created_by. Two-gate display: must be published AND visible. Audience via `faq_audiences` child table.
- **faq_audiences**: faq_id → faqs, user_type, role_title nullable. `null` role = whole type. Unique per (faq, type, role).
- **search_queries**: term text, created_at. Write-only (insert policy, NO select policy); rate-limited 1000/min; `get_popular_searches` uses mode().
- **support_messages**: user_id, name, email, message (capped ~2000). Insert fires SendGrid via server action (support email). Light rate limit.
- **contact_requests**: public contact form (name, email, message, source); rate-limited 60/min.
- **platform_counters**: key text pk, value bigint. Durable counters — `published_reviews_total`, `listed_tournaments_total`, `listed_events_total` — incremented on publish, **never decremented on delete** (deleted reviews still count). `get_platform_stats` reads these.
- **rate_limit_windows**: bucket, window_start, hits (carry-forward infra).
- **cards** (Stripe, DEFERRED): user_id, stripe_customer_id, stripe_pm_id, brand, last4, exp_month, exp_year, is_default. **Only Stripe tokens/metadata — never PAN/CVV.** RLS owner-only.
- **transactions** (DEFERRED, parked): structure stubbed.
- **notifications** (DEFERRED, hidden sprint 1): user_id, type, payload, read_at.

---

## 9. Denormalization, triggers, functions (carry-forward + new)

Carry-forward from current schema (proven): `is_admin()`, `handle_new_user()`,
`touch_updated_at()`, `stamp_premium_at()`, the search infra (`build_event_search_document`,
`search_vector`, GIN indexes, child-table refresh), `rate_limit_touch`/`rate_limit_windows`
+ before-insert triggers, `get_popular_searches` (mode()), `get_platform_stats`,
`needs_password_setup` (anon-revoked).

New/adjusted:
- **recalc_ratings**: on review insert/update/delete → recompute the event's denormalized
  ratings + per-category averages + `would_return_pct` from PUBLISHED reviews (NULL-aware:
  exclude null-scored categories), THEN roll up to the parent **tournament** aggregates.
  SECURITY DEFINER (author role lacks UPDATE on events/tournaments).
- **event status**: `event_display_status(events)` helper (§4).
- **helpful_count**: maintained from `review_helpful` via trigger.
- **counters**: increment `platform_counters` on review publish / tournament / event create;
  never decrement on delete.
- **deletion routines** (SECURITY DEFINER functions, atomic):
  - delete_event / delete_tournament → detach reviews/comments (null FK), copy event snapshot, keep reviewer identity; delete event child data.
  - anonymize_account (attendee) → destroy user_id/email/name/handle/avatar on their reviews+comments, keep content + user_type/role, set anonymized=true, display "Former member".
  - ED account delete → anonymize their comments; delete owned events (→ detach their reviews); claimed events revert owner to admin.
- **promo apply** (atomic RPC): on publish-with-promo → set guru_review, promo→applied+ts, sibling promos→void, recalc. One-review-per-event resolution (create / upgrade draft / upgrade non-verified / block-if-verified).
- **save_event_graph** (atomic RPC, S10.9): the whole event graph — base row + replace-all
  of every child collection — in one transaction; a late child failure rolls everything
  back. Entry guards mirror `p_events_write` (null-uid raise, `is_event_host()`,
  owner-or-admin, parent-tournament access on current AND final parent); new-row ownership
  is computed from the caller's role (admin → unclaimed/claimable per S1.1), never taken
  from the payload; the UPDATE arm never writes `id` (S9.2) or ownership/tier columns.
  EXECUTE revoked from public/anon. `saveEvent` and `duplicateEvent` both route through it.

---

## 10. Security model (carry-forward summary)

- RLS on every table; `USING` (row visibility) + `WITH CHECK` (written values) split.
- **Role predicates, not just ownership**, on the write policies for `tournaments` and
  `events`: `is_event_host()` (= `user_type in ('event_director','admin')`, STABLE
  SECURITY DEFINER, mirroring `is_admin()`) ANDed with the owner check. Ownership alone is
  not an authorization test on these tables — `owner_id` is caller-supplied and grantable,
  so an attendee could name themselves owner and publish into discovery (S10.1, migration
  20260719000001). `is_admin()` implies `is_event_host()`, so admins keep writing the
  unclaimed rows they don't own (S1.1). Event child tables inherit this via their parent
  event's owner check. `submitted_csvs` writes are gated the same way —
  `is_event_host()` + `ed_id = self` + (INSERT) event ownership — so an attendee can't
  inject rows/emails into the admin queue (S10.5, migration 20260719000005). UPDATE on
  `submitted_csvs` is `is_admin()`-only: `status` is the admin review verdict, and admin
  vs ED can't be told apart by column grants (both are `authenticated`), so the owner arm
  was dropped to stop an ED self-approving (S10.7, migration 20260719000006).
- **Parent-row authorization** on `events`: writing an event also requires write access to
  its parent tournament (`t.owner_id = auth.uid() or is_admin()`). `tournament_id` is
  caller-supplied, so checking only the event's own `owner_id` let one ED graft or reparent
  an event onto another ED's tournament — which pollutes that tournament's rollup ratings,
  since `recalc_tournament_ratings` aggregates through `events.tournament_id` (S10.2,
  migration 20260719000002).
- **Column-grant allow-lists** as the privilege-escalation cap (Postgres checks column
  privileges before RLS): `revoke update/insert` then `grant (safe cols)` — omits
  user_type, role, blocked, guru_review, published, counters on profiles/reviews; omits
  is_premium, is_general_ad, premium_at, and denormalized aggregates on events (migration
  20260718000002). Tier flag writes go through `admin_set_premium` / `admin_set_general_ad`
  SECURITY DEFINER RPCs with `is_admin()` entry checks.
- **PII column REVOKE** ordering: revoke table SELECT first, then grant per-column
  (omit email/enumeration keys). service_role bypasses for admin surfaces.
- Every SECURITY DEFINER fn pins `search_path = public, pg_temp` (+ `extensions` if it
  uses unaccent/trgm).
- **Definer guards must be NULL-safe.** `auth.uid()` is NULL for anon, so
  `<owner> = auth.uid()` is NULL — not false — and `if not (…)` never fires: the guard
  falls through and the body runs with BYPASSRLS privileges. Every destructive definer fn
  opens with an explicit `if auth.uid() is null then raise` and writes its ownership test
  as `if (…) is not true then`, never `if not (…)`. Destructive fns are additionally
  revoked from `anon` (S10.3, migration 20260719000003).
- Public projections of locked tables via `security_invoker=false` views / definer RPCs,
  scoped tightly (event_director only), never returning contact_email.
- Public writes (search log, contact, support) rate-limited at DB + app layers.
- **Storage** (S10.4, migration 20260719000004): three buckets defined in SQL. Public
  `event-images` (10 MB) + `org-logos` (5 MB), both png/jpeg; private `promo-csv` (2 MB,
  text/csv). Objects are keyed by the uploader user id as the leading folder
  (`<auth.uid()>/<file>`), so the RLS ownership test is
  `(storage.foldername(name))[1] = auth.uid()::text or is_admin()` with no cross-table
  lookup — user-id keying avoids the event-logo chicken-and-egg (logo uploaded before the
  event row exists). Type + size limits are bucket-level (Storage-API enforced, not the
  file picker). `promo-csv` is `public=false` with owner/admin-only SELECT; retrieval is a
  server-minted signed URL. The DELETE policy is the *sole* guard for cross-owner deletes
  (the service blocks cross-owner overwrites but not deletes), so all four verbs carry the
  folder check.

---

## 11. Decisions log — chat refinements NOT yet in your original files

Your files reflect the pre-chat state. These chat decisions **supersede** them (confirm):
1. **Role lock**: role adjustable during onboarding, locked after completion (files say "editable in profile" — superseded).
2. **Gender + location NOT mandatory** (files' Screen 2 implies mandatory — superseded).
3. **Age dropdown exception** kept; all other selections = blocks.
4. **Password reset**: generic anti-enumeration message (files say "tell them if email doesn't exist" — that's an enumeration vuln, superseded).
5. **Reset rate-limit**: server-side (files describe client timer only — insufficient).
6. **Org Name = Organization Title** (one field, role-dependent label).
7. **Team info edited in Preferences only** (removed from Attendee Profile).
8. **Deletion model** fully reworked: detach+snapshot on event delete; anonymize-and-disclose on account delete (files describe simple delete/retain — superseded).
9. **Promo status** = engagement lifecycle; account-existence = separate Account chip.
10. **Promo URL token** = nanoid, not the 8-char pretty code.
11. **is_premium vs is_general_ad** are two independent flags. `is_sponsored` renamed to `is_general_ad` (migration 20260718000001). Internal label "General Ads", public label "Spotlight". "Featured Events" stays for premium.
12. **Bulk promo send** = background queue; **CSV files** = private bucket.
13. **Email delivery** = SendGrid from server actions (not Edge Functions), except bulk send (queue).
14. **Surface** rename (grass/turf → "surface") everywhere.
15. **"% would return"** = new review question (would_return) + event.would_return_pct.

---

## 12. Open questions (block final SQL — small but real)

1. **would_return question**: coach-only, or coach + team_manager ("coaches/manager")? And is it required for those roles or optional?
2. **Tournament aggregates**: denormalize on the tournament (my plan, faster) vs compute on read? Denormalize is my recommendation.
3. **event_images**: child table (my plan) vs array column? Child table for ordering/limits — confirm.
4. **Admin "log in as a normal user"** (Auth file line 10): does admin impersonation need modeling (an impersonation session), or is it just that admin has a normal dashboard too? Clarify scope.
5. **Recently-viewed retention**: cap the list (e.g. last 50) or unbounded? Recommend a cap.
6. **citext** for email/banned words (case-insensitive) — OK to use the citext extension?
7. **FAQ audience**: single enum (attendee/ed/both) — confirm that's the full set (no admin-facing FAQ).

---

## 13. Resolutions & validation pass (v0.2)

Confirmed answers (supersede §11/§12 where they differ):
1. **Role**: locked — not editable in profile. (Adjustable during onboarding, then locked.)
2. **Gender + Location = MANDATORY** (reverses earlier "optional"). Onboarding-complete set = first_name, last_name, role, dob, gender, location, organization_title (except parent_spectator), org_description (ED).
3. Password reset generic message ✓. 4. Reset rate-limit server-side ✓.
5. organization_title = name (one field).
6. **Landing/public "Featured Events" label STAYS** (no rename). Section shows **premium OR general-ad** events, soonest-first, start > now−30d. `is_premium`/`is_general_ad` remain distinct flags; only the public label is unchanged.
7. **would_return required for both coach AND team_manager** reviews (not parent_spectator).
8. Tournament aggregates denormalized ✓. 9. recently_viewed capped at 50. 10. citext ✓.
11. No admin-facing FAQ (audience = attendee | event_director | both).
12. **Admin login = shared auth screen, role-based redirect** to the right dashboard. No impersonation entity. → BACKLOG: MFA for admin accounts.
13. event_images = child table ✓.

Loose ends closed (defaults — flag if wrong):
- **would_return question** added to the review form for coach/manager reviewers (was absent from the form spec).
- **host_club vs organization_title**: event card shows `host_club` (event field, always present); Host-Info sidebar + claimed-event org display pull the owner ED's profile org (logo/title).
- **Landing "Recent Reviews"** = separate `demo_reviews` table (seeded), never the real `reviews` table (no PII in a public marketing section).
- **One review per event** = unique(author_id, event_id) where author_id not null (one row, draft or published).
- **Comment permissions**: attendees except the review author may comment; owner ED gets one pinned reply; non-owner ED/admin cannot comment (admin may delete). RLS-encoded.
- **Landing 3 popular searches** = hardcoded client config (not search_queries).
- **Reviewer stats popup** (verified-coach vs attendee pools) = computed on read per user (not denormalized on profile).

RESOLVED:
- **would_return_pct pool** = ALL published coach + team_manager reviews that answered (not verified-only). Displayed on featured/premium events.

New tables added by this pass: `demo_reviews` (landing testimonials). BACKLOG: admin MFA.
