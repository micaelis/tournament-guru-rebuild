# DECISIONS

Non-obvious calls made during the rebuild, in slice order. Each entry says
what was chosen, why, and (when it matters) what the alternative would look
like. Add-only; don't rewrite past entries when a later slice supersedes
them — add a new one that references the older by heading.

---

## Slice 0 — Foundation

### S0.1 · Old data model wiped, plumbing kept verbatim
The rebuild targets the from-scratch schema in `tg scoping/schema.sql`. The
old migrations tree, old query helpers (`lib/supabase/queries.ts`,
`lib/data/*`), and every page under `app/(auth|onboarding|site|dashboard)`
referenced dead columns (`full_name`, `contact_email`, `profile_picture`,
`onboarding_complete`, etc.). Preserving them would have required patching
each in place; deleting was cheaper and keeps the branch coherent.

Kept verbatim: `lib/supabase/{server,client,proxy}.ts`,
`lib/rate-limit.ts`, `lib/url.ts`, `next.config.ts`, `app/globals.css`
(trimmed later in step 3), the `app/auth/callback/` email-link exchange
(column name patched: `onboarding_complete` → `onboarding_completed`).

Rewritten: `lib/supabase/session.ts` (new `SessionProfile` type +
`postOnboardingDestination` helper), `CLAUDE.md` (fresh conventions for
the new schema), `supabase/README.md`, `scripts/build-schema.sh`
(removed the demo-seed skip list — no demo seeds this build).

Middleware entry: Next 16 renamed the middleware convention to `proxy.ts`
at the repo root, which the old build already had (thin shim into
`updateSession` from `lib/supabase/proxy.ts` — the Supabase helper).
Keeping the file names as they are; the split (root proxy.ts = Next 16
convention, lib/supabase/proxy.ts = Supabase session helper) is legible
enough with a doc comment.

### S0.2 · No autonomy config file this session
BUILD-PLAN Part 1.2 describes a `.claude/settings.json` autonomy config.
The user's session-level instructions already cover the same autonomy
directive, and my current permission mode approves the tools I need. Not
writing that file — the operator can add it separately for future
sessions if they want to durably codify it.

### S0.3 · Password minimum lowered to 8 chars
The new Auth spec (`tg scoping/Auth & Onboarding.rtf`, signup section)
says *"8 characters minimum, at least 1 uppercase, at least 1 number"*.
The old app enforced 12. The spec is authoritative for the rebuild — the
`validatePassword` helper uses 8/1/1. If the client later wants 12 back,
change the constant in one place.

### S0.4 · Schema semantic fixes

One inline patch to the baseline itself (bootstrap-blocker), plus four
follow-on migrations that layer semantic fixes on top. Each fix migration
has its own timestamped file so the intent is legible in the tree.

**Inline in `20260716000001_baseline.sql` (pre-boot bootstrap fix):**

0. `apply_promo_to_review` search_path adds `extensions`. Baseline set
   only `public, pg_temp`, but the function DECLAREs `v_email citext`
   and citext lives in the `extensions` schema. Postgres validates
   plpgsql DECLARE types at function creation, so the baseline failed
   at that statement. Fixed inline because the migration can't succeed
   otherwise. All other functions that touch citext-typed columns work
   fine because they never DECLARE a citext local.

**Follow-on migrations:**

1. **`dob` and `role_title` added to profiles UPDATE allow-list**
   (`20260716000002`). Onboarding needs to write both. Baseline omitted
   them from the column grant, which would have surfaced as an opaque
   "permission denied for column" error during onboarding.
2. **Role/type lock trigger** (same migration). Spec: role adjustable
   during onboarding, locked after. Column grant lets the client write
   `role_title` (and, defensively, `user_type`); a BEFORE UPDATE trigger
   raises `errcode=42501` if either column changes once
   `onboarding_completed=true`. Baseline had neither the grant nor the
   trigger.
3. **`p_comments_read` tightened** (`20260716000003`). Baseline let any
   caller read comments on a *draft* review as long as the comment
   itself wasn't personally hidden. Now requires the parent review to
   be visible (published / authored by caller / admin) AND the comment
   not personally hidden. Admin still sees everything.
4. **`handle_new_user` picks a role default that matches the incoming
   `user_type`** (`20260716000004`). Baseline hard-coded
   `role_title='coach'`, which conflicts with `role_matches_type` when
   the metadata carries `user_type='event_director'`. Fixed to `coach`
   for attendee, `event_director` for ED, `coach` (neutral placeholder)
   for admin — admin's check-constraint accepts any role_title anyway,
   and admin roles never appear in the UI.

### S0.5 · Location field — Places-backed (was: text-only)
RESOLVED: Google Places autocomplete is wired (July 2026) via
`app/components/LocationAutocomplete.tsx` + `lib/maps/loader.ts`, gated on
`NEXT_PUBLIC_GOOGLE_MAPS_KEY` (note: final env var name differs from the
`_API_KEY` guess below). Onboarding step 2, the account profile, and the
ED event form all write lat/lng/place_id/city/state/zip through it; hidden
inputs carry the payload so Server Actions stay plain (`lib/geo.ts
parseGeoFields`). Without the key every location input degrades to the
original plain text input that writes only `location_formatted` —
coordinates in the DB only ever come from a picked suggestion.
`scripts/geocode-events.mjs` backfills events that predate the wiring.

### S0.6 · Component library colocated under `app/components/ui/`
Not a top-level package. Same-app import paths, less indirection. If
consumers grow beyond this repo we can extract later.

### S0.7 · `StatusPill` accepts a semantic `tone` prop
Rather than one pill component per family (event / promo / CSV / review
status), a single `StatusPill` with a `tone` prop covers all of them.
The tones map to specific bg+fg pairs from the tgredesign palette (5
event states + neutral / positive / warning / danger reuse). This keeps
the primitive count small while still giving every family its own
distinct look.

### S0.8 · Attendees have a dashboard shell too
The RTF specs only list ED + Admin sidebars, but the account/reviews/
favorites/activity RTFs all describe attendee-side dashboards. The
shell in this slice supports all three roles with role-specific nav
items. Attendee post-onboarding still redirects to `/events` (per spec);
they reach `/dashboard/*` via the header avatar menu.

### S0.9 · Hidden ED nav items this sprint
`ED Dashboard pages.rtf` says *"Hide Transactions, Add-on Pricing and
Notifications, FAQ in this sprint."* Those routes exist as stubs
(returning 404 today) but are not linked in the sidebar. Support IS
shown (not in the hide list).

---

## Slice 1 — Events

### S1.1 · Admin edits tournaments only when unclaimed
Spec: *"the option to edit the tournament/add an event is possible
for the admin only if the tournament/event was added by the admin
and has not yet been claimed by an ED."* The page-level
`canManageTournament` returns false when `owner_id !== null` (i.e. an
ED has claimed it). Editing an EVENT is always allowed for admins
per the spec addendum. EDs manage their own only.

### S1.2 · Uploads = URL fields (bucket flow deferred)
**Superseded by S10.4** (storage buckets + RLS shipped). The paste-a-URL
input is retained as a fallback alongside real uploads.

Logo, sponsor logo, event images, org logo, and event video are all
URL inputs for Slice 1. Wiring the Supabase private/public buckets +
signed-upload flow doesn't gate the ED/Admin CRUD story, and the
scoping deferral matches Slice 0's location-input punt (see §S0.5).
Track under the same "storage cutover" follow-up.

### S1.3 · Child collections use replace-all persistence
saveEvent deletes every row in each child collection (age groups,
sponsors, competition levels, surfaces, features, images) and
re-inserts what the client sent. Two motivations:
- The form owns the collection as a single array in useState — the
  server never has to reconcile per-row diffs, and stale IDs can't
  slip in from a lagging client.
- Every child insert flows through server-side validation once,
  regardless of whether the row is "new" or "existing" from the
  client's POV. The DB check-constraints backstop enum values.

The cost is an extra DELETE per collection per save. With
6 collections capped at low tens of rows each, this is a rounding
error and worth the simpler mental model.

### S1.4 · Premium is a flag flip, no Stripe
Spec: *"in this sprint, we are not building the payments/Stripe piece,
because only the client will be managing events for a little while on
launch."* upgradeEvent sets `is_premium = true`; the new
stamp_premium_at trigger (migration 20260716000005) fills premium_at
on the false → true transition. Reverting an event to non-premium is
never surfaced in the UI — the client can do it via SQL if needed.

### S1.5 · Admin search + sort by owner runs in-app
The admin scope of `listTournaments` fetches all rows, joins owner
first_name/last_name in a second query, and filters + sorts in JS.
Alternative: Postgrest embedded-resource order + a computed
full-name view. In-app is simpler and admin volume is low; if the
tournaments table grows past a few thousand rows this becomes the
right thing to migrate to a materialized view + a proper GIN index.

### S1.6 · CSV export = current view + admin-only
Spec: *"the exported list must match what the admin sees on the
screen."* The CSV route reads `?q=` and `?sort=` from the request
URL and runs the exact same listTournaments + listEventsForTournaments
pair the page runs. The `description` column is intentionally left
blank in the export because it isn't part of the compact list
projection; widening the list projection just for the CSV would make
every page fetch heavier. If the client wants description in the
export, the CSV path can fetch it in batches on demand.

### S1.7 · QR generation is on-demand, not cached
Spec says the button changes from "Generate QR Image" to "Open QR
Image" if one exists. We render "QR" always and generate on click.
Rationale: the QR encodes a stable URL, so caching gains nothing
(the URL doesn't change and QR generation is a few ms + a couple KB
buffer). Caching would add storage bucket + cleanup work with zero
correctness benefit.

---

## Slice 2 — Reviews & engagement

### S2.1 · Rich-text review body deferred to plain text
Spec mentions inline formatting (bold, italic, strike, underline,
list, link, emojis). Shipping a real rich-text editor (TipTap /
ProseMirror) + a server-side sanitizer allow-list is a sizable
addition and would gate everything else in Slice 2. Plain-text body
covers the review MVP; the sanitizer stays in the plan for a
follow-up alongside the deferred private-storage upload flow.

### S2.2 · Banned-word matching mirrors on client + server
`findBannedWords` exists in two files — `lib/reviews/banned-words.ts`
(server, with `server-only`) and `lib/reviews/client-check.ts`
(client, plain). Same regex logic, same result. Server side is
authoritative on submit; client side gives real-time feedback while
typing without an extra round-trip per keystroke. When the list is
edited, the fresh copy fetches on the next server call — no cache
to invalidate.

### S2.3 · Replace-all owner reply (no separate edit-reply branch)
Spec allows an ED to delete and add a new reply. The action treats a
new-reply insert as delete-then-insert: it wipes any prior
`is_owner_reply=true` row on the review before inserting the new one,
so an "edit" is a re-post from the ED's perspective, and the code
path is one write instead of two.

### S2.4 · CSV export happens client-side
Dashboard bulk export builds the CSV in-browser and downloads via a
Blob. Selection state is client-owned already (the checkboxes live
in useState), so streaming the whole row set through a server route
would double-fetch. Cap is 30 rows per page (spec) — well under any
memory concern.

### S2.5 · Attendee state filter uses review snapshots
The list projection for the attendee's "My Reviews" doesn't join the
current event row (would blow up the query for detached rows). The
state filter reads from `snapshot_event_location`'s trailing 2 chars,
which are stamped when the event is deleted. Live events don't have
the snapshot set — those rows currently pass the filter. If the
client wants a strict state filter on live events too, the follow-up
is a second query that pulls `events.location_state_abbr` in a batch
and merges it into the row set.

### S2.6 · platform_counters.published_reviews_total never decrements
Spec: "even if the published review was deleted, the system should
still count it towards the total nr of published reviews alongside
other app metrics like listed tournaments and listed events." The
baseline trigger only increments; delete leaves the counter alone.
Same rule already applies to events + tournaments per SCHEMA-DESIGN
§8.

### S2.7 · Reviewer-details popup deferred
Spec calls for a two-column popup (Verified Coach vs Attendee stats)
when clicking a username on the dashboard. That's a separate query
+ layout; the review table renders the reviewer identity inline and
that covers the "who wrote this" use case. Follow-up when time
frees up.

### S2.8 · Location state on events for dashboard state filter
`ReviewsTable`'s state filter uses `event.location_state_abbr`
directly (already selected in the joined projection). Simpler than
mapping through the state seed table.

---

## Slice 3 — Promo system

### S3.1 · CSV bucket upload deferred, email list stored inline
**Superseded by S10.4** (private `promo-csv` bucket + signed-URL flow
shipped). `raw_emails` is still stored inline so the admin queue renders
without a bucket read; the bucket now also holds the original file.

The private storage bucket + signed upload/download URL flow is a
follow-up (paired with the Slice 0 org-logo defer + Slice 1 image
uploads under one "storage cutover" task). Meanwhile, migration
20260716000007 adds `submitted_csvs.raw_emails jsonb` — the parsed
email list stores inline so the admin queue can render + preview +
regenerate the CSV without a bucket read. Max 1000 rows per file
per spec keeps the JSONB well under any practical size.

### S3.2 · Eligibility pre-flight is a pass-through until service-role
Spec: emails that hit an existing account with `user_type != coach`
should show a "This email is already in use…" warning + auto-
exclude. Doing that check requires a lookup against auth.users.email
which the anon+authenticated clients can't read (RLS-protected).
Full check needs SUPABASE_SERVICE_ROLE_KEY plumbed through a
server-only client. Deferred; the send action still voids prior
non-applied promos + inserts fresh rows so no correctness issues.

### S3.3 · In-process batches instead of a real queue
Spec calls for Inngest / Trigger.dev / QStash. For the launch phase
(the client running events on-behalf for a while) the total email
volume is low tens per submission. Batches of 5 with a 100ms
throttle keep the whole dispatch inside one server-action call, and
SendGrid handles the load fine. Follow-up: wire a real queue when
CSV submissions get past a few hundred rows per day.

### S3.4 · Promo landing routes through the standard signup, not a mini-wizard
Spec describes a bespoke 3-step onboarding on the promo landing
(email/name/organization → location/gender/dob → team info). That
duplicates the /onboarding wizard we already have. We routed the
promo landing through /signup with email pre-filled +
type=attendee+role=coach preselected, then /onboarding, then the
review form. Same fields collected, same validation, no new UI
surface. The follow-up to consolidate the auth variants (spec calls
this out) can compare the three properly with this variant already
built on top of the standard flow — one less thing to unify.

### S3.5 · Promos filtered to sent/active/applied
The Coaches list drops staged + void rows so the table only shows
actionable promos. Staged is a transient state (spec keeps it for
Bubble backfills) and void rows are historical. Attendee list uses
the same filter — displays only rows meant for them today.

---

## Slice 4 — Claim system

### S4.1 · Approve/decline via SECURITY DEFINER RPCs
Ownership transfer touches four tables (claim_requests +
tournaments + events + other pending claim_requests) in one
logical operation. Doing it via `.update()` calls across the
supabase-js client couldn't be atomic — a partial write could
leave the tournament transferred but the events untouched. The
RPCs run everything inside one transaction, gate on is_admin() at
entry, and use `set search_path = public, pg_temp` so a malicious
extension can't hijack the resolution.

### S4.2 · Linky separator = newline-or-comma
Spec asks for links[] but doesn't fix a UX shape. A single
textarea (one link per line, comma also accepted) is simpler than
per-row "+ Add link" plumbing at Slice 4 scale. Every entry runs
through `safeExternalUrl` before insert.

### S4.3 · Claim CTA lookup piggybacks the initial page fetch
The public event page already queries the row; adding
`tournament_id` + `owner_id` to that projection removes a second
round-trip for the "Requested" pill lookup. `hasPendingClaim`
runs only when signed-in ED + unclaimed event, so most page loads
skip it entirely.

### S4.4 · Auto-decline reason is canonical text
Sibling pending claims auto-declined at approval time carry
`decline_reason = 'Another claim on this tournament was approved.'`
Baked into the RPC so the reason stays consistent across all
sibling declines and the audit trail on the ED dashboard reads
cleanly.

---

## Slice 5 — Public discovery

### S5.1 · Popular searches pad with baked-in defaults
Fresh installs have zero rows in `search_queries`, so
`get_popular_searches` returns empty. The landing page fills the
gap by appending three "approved default" chips (Youth Soccer, U12
Girls, Kansas City — placeholder terms that make the hero look
alive on day one). Once real queries accumulate the DB set takes
over and the defaults drop out.

### S5.2 · Map + distance-from-me deferred
The full search-events surface in the spec includes a sticky map
+ distance filter. Neither is on the critical-path for MVP and
they carry their own dependency graph (Leaflet, geocoding,
distance math against user's saved location). Deferred to a
follow-up alongside the Google Places autocomplete from Slice 0.

### S5.3 · Child-table filters intersect via id sets
Surface / level / age filters resolve to a set of matching
event_ids each, then intersect. Cheaper than four self-joins in a
single query and keeps each sub-query using its own index
(event_age_groups(age), event_surfaces(surface), etc.).

### S5.4 · Directors read public view, not table
Both /directors surfaces query the `public_directors` view that
the baseline defines with security_invoker=false. Guarantees email
+ DOB never come through even if a future edit widens the select
list. Owner-side dashboard queries still read the full profiles
row via RLS.

---

## Slice 6 — Account & activity

### S6.1 · Soft-delete via anonymize + scrub, auth.users stays
Spec: "delete their data, including reviews and comments." The
schema's `anonymize_account` already nulls author identity on
reviews + comments but keeps the content. `scrub_profile_identity`
extends that to the profile row (nulls everything, sets
blocked=true so the proxy signs the user out on the next request).
Hard-deleting the auth.users row requires a service-role client;
that's a follow-up. For MVP the "Former member" cards land as
soon as the RPC finishes.

### S6.2 · Recent-view cap enforced by trigger
`trim_recently_viewed` fires after every insert and keeps the
per-user set at 50 rows. Simpler than a scheduled cleanup + means
we can never fetch more than 50 by construction.

### S6.3 · Support form uses the same SendGrid helper as promos
No separate template ID — the support message reuses
`sendPromoEmail` with the operator's inbox as the recipient. When
env vars aren't set the log-stub still writes to
support_messages so the inbox on the admin side (deferred surface)
can pick it up. Real routing to a distinct SendGrid template is a
one-liner follow-up.

---

## Slice 7 — Admin content ops

### S7.1 · Delete-flagged-review cascades child comments via FK
Spec: delete the review + its comments + flag records. The
schema's ON DELETE CASCADE from reviews to comments handles
comment removal automatically; the action only has to delete
flagged_content rows first (so the reviews-recalc trigger picks
up the aggregate change on the parent event) and then delete the
review row. No new triggers, no bespoke fan-out.

### S7.2 · Admin block + delete route through SECURITY DEFINER RPCs
The `blocked` column is deliberately out of the client UPDATE
allow-list, so the admin flip needs a wrapper. admin_set_blocked
+ admin_delete_user gate on is_admin() at entry; delete_user
delegates to delete_ed_account / soft_delete_attendee (Slice 6
rpcs) so the same soft-delete rules apply whether the user
initiates it or an admin does.

### S7.3 · FAQ CRUD backed by native <details>
FAQ list uses native <details> for expand/collapse rather than a
custom accordion. Fewer moving parts, better keyboard support out
of the box, and it matches the audience-facing display on the
Support page.

---

## Review Gate 1 remediation

### RG1.C1 · handle_new_user coerces the type; admin is never a self-signup
Migration 20260716000011 rewrites the trigger: whatever
`raw_user_meta_data.user_type` the client sends, we resolve to
`event_director` iff exact match, otherwise `attendee`. `admin` is
NEVER accepted. Role_title is then coerced back into the type's
valid set (mismatched combos land on the safe default per type).
Probe `c1-signup-privilege-escalation.test.ts` fires
`signUp({data:{user_type:'admin'}})` via the anon key and asserts
the resulting profile is attendee.

### RG1.C2 · Pattern-class definer guards + REVOKE sweep
Same migration:
- Destructive callables (delete_event, delete_tournament,
  scrub_profile_identity, anonymize_account, soft_delete_attendee,
  delete_ed_account) all get an `is_admin() OR ownership` check at
  entry — a normal user hitting them gets 42501.
- Trigger-only + recalc helpers have EXECUTE revoked from
  `public / anon / authenticated` so PostgREST can't call them at
  all: handle_new_user, touch_updated_at, all trg_*, stamp_premium_at,
  recalc_event_ratings, recalc_tournament_ratings, review_overall,
  rate_limit_prune, trg_lock_profile_role, trim_recently_viewed.
Probes in `c2-definer-guards.test.ts` verify each entry point
rejects a non-owner authenticated caller.

### RG1.C3 · apply_promo_to_review validates the whole chain
Function now checks: caller signed in, review exists, review not
already-guru, caller = review.author_id, promo exists, promo not
applied/void, promo.event_id = review.event_id, promo.email =
auth.users.email OR promo.user_id = auth.uid(). Sibling promos
still auto-void. Probes in `c3-apply-promo.test.ts` cover the
attacker case + the wrong-email case + the legit path.

### RG1.C4 (+M2) · Definer promo landing RPCs with email binding
Migration 20260716000012 introduces:
- `promo_landing_info(p_token)` — anon-callable, returns just event
  + email so the anon signup can pre-fill the target email. Safe:
  the caller already has the token from their inbox.
- `claim_promo(p_token)` — authenticated-only, verifies
  auth.users.email = promo.email before flipping 'sent'→'active',
  attaching user_id, and inserting a `landed` funnel event.
Both grant EXECUTE to the appropriate role. The `/promo/[token]`
page routes through these instead of touching `promo_codes`
directly. Full flagship flow probe in `c4-promo-flow.test.ts`:
CSV → promo issued → anon lands → coach signs up with matching
email → claim_promo → publishes review → apply_promo_to_review →
guru_review = true.

### RG1.H1 · Public reviewer/host reads go through DEFINER views
Same migration widens `review_author_public` to include
organization_title and adds two new views:
- `public_comment_authors` (comment_id, first_name, org, org_logo,
  photo, user_type, is_owner_reply)
- `public_event_owners` (id, first_name, org, description, logo,
  photo)
`listReviewsForEvent` + `listCommentsForReview` now fetch the base
row set from the RLS-gated tables, then attach identity via a
batched `.in()` against the view. Public event page's host sidebar
also switched to `public_event_owners`. `h1-public-views.test.ts`
asserts anon can read `first_name`+`organization_title` from the
view but gets no rows on a direct `profiles` read, and that
`last_name` is not exposed by the view.

### RG1.H2 · preferences_completed drives the wizard, not distance_pref
Same migration adds a `profiles.preferences_completed boolean`
column + grants UPDATE on it to authenticated. `saveStep3` sets it
true regardless of whether the user filled the optional fields;
`step3Done()` in the page now reads that flag. ED skipping the
distance / team pickers advances cleanly to step 4.
`h2-onboarding-step3.test.ts` covers the flip via the client
UPDATE grant.

### RG1.Tests · vitest wired to `npm test`
`tests/harness.ts` sets up anon + service_role clients pointed at
the local Supabase stack. Probe files (one per critical + high +
one per flow area) all pass on the current tree. `npm test` runs
the whole suite in ~11 s. Regressions caught: any of the RG1
issues would flip one of the probes red on the next PR.

### Backlog · event_milestones editor
The public event page reads `event_milestones` for the "Key dates"
section, but the Add/Edit Event form doesn't yet include a
milestones editor — the section always renders empty in production.
Turbo-check M-DEAD-2 flagged this; for now the render is gated on
`milestones.length > 0` so an empty section doesn't ship, and
wiring the editor stays on the backlog (spec calls for two
auto-created milestones — Early-Bird Ends + Registration Deadline
— plus manual entries per SCHEMA-DESIGN §3).

### RG1.Lint · 4 errors fixed
- `app/(auth)/layout.tsx` — apostrophe → `&apos;`.
- `app/(auth)/reset/RequestResetForm.tsx` — reworked cooldown to a
  Date.now()-based expiry with an interval-driven `now`. The one
  cross-effect setState carries a linter disable comment + an
  inline note explaining why (external form-action signal, not
  derived state).
- `app/dashboard/account/page.tsx` — `any` casts replaced with
  exported `AccountProfile` + `AccountTeam` types.

### S5.1 · KeyDatesCard gated on `event.premium`
The Key Dates & Deadlines card on the event-detail page now renders
only when `event.premium` is true. The spec already designates Key
Dates as "featured only" (§5.3, §3.2); this aligns the code with
that rule. Previously the card rendered for all events but showed
empty because no milestones editor exists yet for free-tier events
(see Backlog · event_milestones editor above). Gating it avoids
an empty card rendering for non-premium listings.

### S5.2 · E2E regression sweep — 1 app bug, 4 stale tests
Five E2E specs failed on the clean tree. Root-caused each:

1. **APP BUG — EventForm `canPublish` always false for new events.**
   `canPublish` read `defaults.base.title` (the empty initial prop)
   instead of the live input value. The Publish button stayed
   `disabled` permanently. Fixed by tracking the title with state.

2. **STALE — onboarding tests expected direct redirect to /events
   or /dashboard/events.** The app now routes through an
   `/onboarding/success` interstitial (intentional UX). Tests
   updated to click through the success page CTA.

3. **STALE — dashboard attendee-bounce expected /dashboard/events.**
   Attendees cascade: /dashboard/users → /dashboard/events →
   /events (the events dashboard redirects attendees to public
   search). Test updated to expect /events.

4. **STALE — reviews ED-bounce expected `?msg=attendees-only`.**
   The redirect now uses `?flash=info:Only attendees can write
   reviews` (the URL-driven toast system). The flash param is
   consumed and stripped by the client. Test updated to assert
   the toast message text instead of the URL param.

---

### S6.1 · Three-tier model — Premium / General Ads / Standard

**What:** `is_sponsored` renamed to `is_general_ad` (migration
20260718000001). The two paid tiers are Premium (`is_premium`, public
label "Featured") and General Ads (`is_general_ad`, public label
**"Spotlight"**). Everything else is a standard listing (not a tier).
The old `SponsoredBanner` component was removed.

**Why:** the client confirmed that the old "sponsored" concept IS
General Ads — one flag, one concept, no second boolean. The rename
aligns the DB with the agreed naming. "Spotlight" was chosen as the
public label (per call with Tanya) because the old "Recommended for you"
placeholder was misleading.

**Placements built:**
- Search page: Spotlight horizontal-scroll section between Featured and
  Event Listings (hidden if empty, soonest → latest).
- Attendee dashboard: permanent sticky right column (270 px, max 3
  events, shuffled each page load).
- Admin dashboard: General Ads on/off toggle on the event detail page.
  EDs cannot toggle — admin-only while paywall is off.

**Alternative:** keep `is_sponsored` and add a separate `is_general_ad`.
Rejected — the client confirmed they are the same concept, and carrying
two booleans would create contradictory state.

### S6.2 · Event tier column grants — admin-only at the DB boundary

`is_premium`, `is_general_ad`, and `premium_at` on `events` were writable
by any event owner via the RLS `p_events_write` policy (which checks
`owner_id = auth.uid() OR is_admin()`). The server actions hid the
controls from non-admins, but a motivated ED could call `.update()`
directly and self-promote their event.

**Fix (migration `20260718000002`):** revoke blanket UPDATE/INSERT on
`events` from `authenticated`; re-grant on all columns except the tier
flags and denormalized aggregates (same pattern as profiles/reviews
column grants in the baseline). Two SECURITY DEFINER RPCs
(`admin_set_premium`, `admin_set_general_ad`) with `is_admin()` entry
checks are the only write path. Server actions now call the RPCs
instead of `.update()`.

**Probes:** `event-tier-escalation.test.ts` — 5 cases (ED direct
UPDATE denied × 2, ED RPC denied × 2, admin RPC succeeds × 1).

**Alternative:** application-level `is_admin()` check in the server
action. Rejected — RLS is the security boundary per CLAUDE.md; client
checks are UX only. Column grants enforce at the DB so even a direct
PostgREST call can't bypass.

### S6.3 · Spotlight column filter corrected — end_date > now − 25 days

The initial build filtered the Spotlight column on `lifecycle = 'active'`
AND `start_date >= today`. The correct rule (decoded from the Bubble
spec, item A1) is: `is_general_ad = true` AND lifecycle is NOT draft or
canceled AND `end_date > now − 25 days`. This shows events that ended
up to 25 days ago, ongoing events, and upcoming events — broader than
"future only" so recently-concluded events stay visible briefly.

Card fields updated: date range (start – end), city + state code
(instead of full location_formatted), and a favourite heart button.

### S6.4 · start_date / end_date stay nullable — publish enforces

Dates are nullable for drafts (a draft requires only a title) and
required at publish via server-side validation. The Spotlight filter
already excludes drafts, so every published event reaching the filter
has an `end_date` — no DB NOT NULL constraint is needed. The existing
`end_after_start` CHECK constraint passes when either date is null,
which is correct for drafts.

**Alternative:** NOT NULL on both columns. Rejected — drafts don't
require dates, and forcing them would break the "a draft needs only a
title" rule.

### RG1.C3 · Claim approve parked

The `approve_claim_request` RPC exists and is tested (claim-flow
probes), but the feature isn't ready for production use — the admin
workflow still needs manual verification steps before ownership
transfer. The Approve button is visibly disabled and the server action
short-circuits with an error message. Decline remains functional so
admins can still reject bad claims.

**Alternative:** leave Approve live. Rejected — premature ownership
transfer in production could reassign events to the wrong ED with no
undo path.

### S8.1 · Review eligibility model — attendee-only writes + paid-only guru

**What:** reviews INSERT policy tightened to attendee-type, non-blocked
users only. EDs and admins are denied at the RLS boundary, not just
the UI. The `apply_promo_to_review` RPC now rejects promo applications
on non-paid events (requires `is_premium` or `is_general_ad`).

**Why:** the scope doc (SCOPE-review-eligibility.md) defines reviews as
an attendee activity; EDs interact via replies on their own events,
admins via moderation (edit/delete). The paid-event guru gate prevents
verified badges from appearing on free listings (the promo model only
makes sense for paid tiers).

**Alternative:** allow EDs/admins to write reviews (old behavior). Rejected
— conflates the reviewer and platform-operator roles. An ED reviewing
events (including competitors') is a conflict of interest the platform
should prevent at the DB, not rely on UI to hide.

### S8.2 · Default table grants fix for `supabase db reset`

**What:** migration 20260718000005 sets `ALTER DEFAULT PRIVILEGES FOR ROLE
postgres` to match the `supabase_admin` defaults, then retroactively
grants on all existing tables + re-applies column-level restrictions
(profiles, reviews, events).

**Why:** `supabase db reset` runs migrations as the `postgres` role, whose
default privileges only grant DELETE/TRUNCATE/TRIGGER/REFERENCES — not
SELECT/INSERT/UPDATE. Tables created during reset lacked basic access
for `authenticated` and `service_role`, breaking all RLS-gated reads and
writes. Also fixed: `dob` and `preferences_completed` added to the
profiles UPDATE column grant (both are written by the authenticated
client during onboarding).

**Alternative:** run migrations as `supabase_admin`. Not possible with the
local CLI's `db reset` command.

### S8.3 · Business contact fields for EDs

**What:** Added `business_phone`, `business_email`, `business_website`
columns to `profiles`. Exposed through the `public_directors` definer
view (security_invoker = false) so the auth email is never leaked. The
event detail ContactPanel renders them when populated; EDs set them in
Account → Profile.

**Why:** The spec calls for phone/email/website in the host sidebar, but
the only email on the profile was the auth email, which is PII. A
separate set of designated public-contact fields keeps the auth email
private while giving EDs a way to surface a business inbox.

**Alternative:** Store contact info per-event (on `events` table). Rejected
because it duplicates across every event and the spec ties it to the
host identity, not the event.

### S8.4 · FAQ system — audience-targeted with two-gate visibility

**What:** Upgraded the `faqs` table from a simple enum audience column to
a child table (`faq_audiences`) supporting per-type + per-role targeting.
Added `status` (draft/published) and `is_visible` columns as independent
gates: an entry must be both published AND visible to appear outside the
admin page. Admin CRUD at `/dashboard/faqs`; viewer at `/dashboard/faq`
(attendee + ED, filtered by type/role); public `/faq` shows all
published+visible entries.

**Why:** The scope calls for role-level granularity (Coach vs Team Manager
vs Parent) and a separate visibility toggle independent of draft status.
The old `faq_audience` enum couldn't represent per-role targeting.

**Alternative:** Keep the enum and add role filtering as a separate
column. Rejected because it couples audience cardinality to the enum
definition and can't represent "attendee:coach + event_director:all".

### S8.5 · Public projection views are read-only at the grant layer

**What:** migration 20260718000008 revokes INSERT/UPDATE/DELETE (plus
TRUNCATE/REFERENCES/TRIGGER) on every view in `public` from `anon` and
`authenticated`, leaving SELECT. Supersedes the grant description in
[S8.2](#s82--default-table-grants-fix-for-supabase-db-reset).

**Why:** 20260718000005's `grant all on all tables in schema public`
also hit views — in Postgres `ALL TABLES` includes them. The `public_*`
views carry no RLS of their own and are declared `security_invoker =
false` with `postgres` as owner (which has BYPASSRLS), so a write
through an auto-updatable view executes as the owner and skips RLS on
the base table. Table-level grants are therefore the *only* access
control on them. `public_directors` and `public_event_owners` are
single-table selects and thus auto-updatable, so `anon` could UPDATE or
DELETE rows in `profiles` holding nothing but the public anon key —
verified end-to-end against the REST API (`PATCH → HTTP 204`, write
landed in the base table; `DELETE` orphaned the director's events).
The baseline granted SELECT only (20260716000001 l.1011); 000005
silently widened it.

The revoke loops over all views rather than enumerating, so the two
currently non-auto-updatable views are covered if their definitions are
ever simplified to a single table.

**Tripwire:** `tests/probes/h1-public-views.test.ts` gained an `it.each`
write-denial matrix (anon + authenticated-non-owner × UPDATE/DELETE/
INSERT × all four views) plus a base-table assertion. Verified
non-vacuous by mutation: re-granting write makes 8 of those tests fail.
The helper rejects a 42703 (undefined column) result explicitly, because
that would mean the probe never reached the privilege check — the same
false-green shape found in the c2 probe during the turbo-check.

**Known gap:** 000005's `alter default privileges ... on tables` still
grants write on views created *after* it, so a new view starts out
writable. The probe's `PUBLIC_VIEWS` list must be extended when a view
is added; that list is the guard.

**Alternative:** set `security_invoker = true` on the views. Rejected —
these views exist precisely to expose a narrow public projection of
RLS-protected rows to anon, which invoker semantics would break.

### S8.6 · Support-page FAQ ported to the new schema + a schema-drift probe

**What:** `/dashboard/support` was still selecting `faqs.body` and
`faqs.audience`, both removed by [S8.4](#s84--faq-system--audience-targeted-with-two-gate-visibility)
(20260718000007 renamed `body`→`content` and dropped `audience`). The
query now mirrors `/dashboard/faq`: two-gate filters (`status =
'published'` and `is_visible`) plus audience targeting via the
`faq_audiences` child table, and it throws on error instead of
discarding it. Added `tests/probes/schema-drift.test.ts`.

**Why:** three things had to line up for this to ship green. The error
was discarded (`const { data } =`), so PostgREST's 42703 became `null`
→ `data ?? []` → an empty list. The result was cast with
`as unknown as`, so `tsc` saw nothing. And the empty state read *"We'll
add answers here soon"* — indistinguishable from success. Every
attendee and ED saw a permanently empty FAQ list for a full release.

The root cause is structural: the DB boundary is untyped, so no static
check can see column drift. The probe replays every
`.from(t).select(c)` pair in `app/` and `lib/` against the live DB with
`limit(0)` — PostgREST parses the select natively, so a dropped or
renamed column fails as 42703 there. 134 sites covered; selects built
from template literals are skipped and logged so the blind spot stays
visible. Verified non-vacuous by mutation: restoring the old column
list fails the probe with the exact original error.

**Note:** this page's FAQ block now duplicates `/dashboard/faq`, which
sits directly above it in the same nav section. Fixing was chosen over
deleting to keep the change reversible; consolidating the two surfaces
is tracked in TURBOCHECK.md (M-3).

**Alternative:** generate types via `supabase gen types typescript` and
type the clients. Strictly better and still worth doing, but it is a
repo-wide change; the probe delivers the same regression coverage for
this class today without touching 155 call sites.

### S8.7 · Account profile saves are partial, not whole-row

**What:** `updateProfile` and `updateNotificationPrefs` now write only
the columns whose inputs were actually submitted, instead of writing
every column on every save.

**Why:** the profile form renders different field sets per role — the
location autocomplete, gender radios and organization field are wrapped
in `{!isAdmin && …}`, and the business-contact block in `{isEd && …}`,
all inside one `<form>`. The action read every field unconditionally, so
an unrendered input arrived as `""`, became `null` via `|| null`, and
overwrote real data. `parseGeoFields` compounded it by returning all-null
when its hidden inputs were absent. An admin correcting a typo in their
last name silently nulled `location_formatted`, all seven `location_*`
columns, `user_gender` and `organization_title` — and the action returned
*"Profile updated."*

Presence in the FormData is the signal: a rendered-but-emptied field is
still present, so deliberate clears keep working. Notification prefs
need a different signal, because an unchecked box is absent exactly like
an unrendered one — each `NotifRow` already emitted a
`section:<name>` hidden marker (previously unread), so that now gates
which pairs are written.

**Tripwire:** `e2e/account-partial-save.spec.ts` drives the real form and
the real Server Action as an admin, then reads the row back with the
service role. It asserts the location input is genuinely absent first, so
the test can't pass for the wrong reason, and a second case asserts a
deliberately-emptied field still clears. Verified non-vacuous by
mutation: restoring the unconditional write fails with
`Expected "Kansas City, MO" / Received null`.

**Alternative:** render the hidden fields as disabled inputs carrying
current values. Rejected — it ships every user's stored location and
gender to the client on a page that deliberately hides them.

### S8.8 · searchEvents surfaces facet errors; filter input is allow-listed

**What:** every query in `lib/events/search.ts` — the five facet
sub-queries, the distance prefilter, the main events query, the two
enrichment reads, and `getEventFacets`' states read — now routes through
a checked `unwrap()` / `unwrapRows()` (`lib/supabase/unwrap.ts`). In the
same change, user-supplied filter values are normalized before any query
runs: unknown facet values are dropped against the enum allow-lists,
malformed dates are ignored, and the `q` ilike patterns are
double-quoted for PostgREST's `or()` grammar.

**Why:** the earlier searchEvents fix guarded only the last of its six
queries, and the facet sub-queries routed failures *around* that guard —
a facet error became an empty id set, which became `.eq("id",
ZERO_UUID)`, which made the guarded query succeed with 0 rows. An RLS or
schema change on any facet table would silently blank every filtered
search (TURBOCHECK H-0). Surfacing those errors exposed a coupled hole:
the facet columns are Postgres enums and both routes pass raw URL values
into `.in()`, so a hand-edited `?genders=zzz` raises a real 22P02 —
which post-fix would be a user-triggerable 500. The two halves must land
together: once user input cannot manufacture a query error, every error
that remains is a genuine infrastructure failure and throwing is
correct. The same sweep fixed a live pre-existing bug: a `q` containing
a comma or paren broke the `or()` grammar and 500'd the events page.

**Behavior change:** a filter carrying only unknown values previously
returned 0 events (via the swallowed enum-cast error); it now behaves as
if that filter were unset — the same convention both routes already
apply to an invalid `sort` or `dist`.

**Tripwire:** `tests/probes/h0-search-error-surfacing.test.ts` runs the
real `searchEvents` under vitest (new `@/` + `server-only` aliases in
`vitest.config.ts`); the client factory is mocked to wrap a real
local-stack client in a proxy that rewrites one table name per test to a
nonexistent one, so each failure is a genuine PostgREST error that hits
ONLY the targeted sub-query while the main query stays healthy — exactly
the case that used to slip through. Verified by mutation: reverting
`search.ts` to the pre-fix version fails 10 of 15 cases.

### S8.9 · The error-surfacing class: every fail-open read routed through unwrap

**What:** all 21 live "class A" query sites — public/user-facing reads
whose failure rendered as a plausible empty state or 404 — now route
through `unwrap()`/`unwrapRows()`: the director pages
(`lib/directors/queries.ts`, all 11 sites), the public event page
(`loadEvent`), the review-write picker, both FAQ viewers and the FAQ
admin list, the public directors index, favorites, activity, the
moderation queue, admin users, support messages, banned words, the ED
review scoping read (the H-0 ZERO_UUID shape again), the account page
self-reads, and `getEventForEdit`'s seven child reads (whose failure
would load an empty form section that the replace-all save then
persists as a deletion). `lib/reviews/queries.ts`' identity/promo
enrichment helpers and `fetchBannedWords` throw too — a failed
banned-words read had silently disabled the moderation filter.

Two designed degraded states are kept but made LOUD via
`unwrapRowsLogged`: landing chrome (`fetchPopularSearches`,
`fetchFeaturedEventRows`, `fetchFeaturedEvents`, `fetchDemoReviews`,
the dashboard Spotlight column) renders empty on failure but always
logs. `getEventDirectors` now returns `source: "unavailable"` on a
query failure — reaching the About grid's "temporarily unavailable"
branch that was designed in `app/components/types.ts` and never
connected (TURBOCHECK M-21) — instead of the lying "no directors yet".

**Deliberately left (with reasons):**
- ~35 authz/guard reads that fail CLOSED (error → deny/redirect) —
  correct as written; surfacing would trade a safe denial for a 500.
- The middleware blocked-user check (`lib/supabase/proxy.ts`) and the
  login blocked-check fail OPEN on a query error. Making them
  fail-closed could sign users out on transient errors on every
  request — an availability trade-off that needs a product decision.
- Server Actions whose WRITE errors are dropped (saveEvent child
  deletes/inserts, faq_audiences writes, updateTeams distance_pref) —
  a different class (dropped write errors), tracked for a future item.
- `fetchFeaturedEvents` / `fetchDemoReviews` appear to have no
  importers (landing uses `fetchFeaturedEventRows` + static demo
  data) — dead-export cleanup left for a consolidation pass.

**Tripwire:** `tests/probes/error-surfacing.test.ts` — same real-error
proxy mechanism as the H-0 probe, pinning all three contracts (throw /
designed-degrade-with-marker / logged-degrade) on representative
functions. Verified by mutation: reverting the four probed modules
fails 8 of 10 cases.

### S8.10 · Moderation-row cleanup moved to the DB (orphaned flags, H-4)

**What:** `flagged_content` and `content_hidden` are now purged by
AFTER DELETE triggers on `reviews` and `comments`
(`purge_moderation_rows()`, migration `20260718000009`). The app-side
cleanup in `deleteFlaggedContent` — the only path that had any — was
removed as redundant; `deleteReview`, `deleteComment`, owner-reply
replacement, and every future delete path are covered automatically.

**Why:** both tables are polymorphic (content_type + content_id), so no
FK cascade can exist and cleanup was app code's job — 6 delete paths, 1
partially covered. An orphaned flag row is worse than dead weight: the
moderation queue lists it, joins it against content that no longer
exists, and renders nothing — an entry no admin can see or dismiss.
Patching call sites is how it got to 1-of-6; row-level triggers cover
cascaded deletes (review → comments, comment → child replies) that app
code structurally cannot see. SECURITY DEFINER because the deleting
user (a reviewer removing their own review) is not allowed to delete
other users' flag rows; EXECUTE revoked per the RG1 trigger-function
convention and added to the c2 revocation guard.

**Tripwire:** `tests/probes/flag-orphans.test.ts` — drives deletes
through the real roles (the reviewer's own client) and asserts zero
moderation rows survive, including a whole-table orphan sweep. Verified
by mutation: dropping the two triggers fails all 3 cases; a from-zero
`supabase db reset` rebuilds green.

### S8.11 · Account actions revalidate like the rest of the app (H-8)

**What:** `updatePassword` now enforces the full `validatePassword`
policy (8 chars + uppercase + digit) server-side instead of only
`length >= 8`, and `updateProfile` runs `business_email` through
`validateEmail` before storing it.

**Why:** the client showed the strict rule while the server accepted
weaker input — "the server is authoritative" is this project's stated
convention, and signup + reset both already enforce the same policy, so
a crafted request to the account action was the one door where a
non-conforming password could enter. `business_email` is the same
asymmetry one field over: rendered publicly on event pages, stored with
no validation at all.

**Tripwire:** `tests/probes/h8-password-validation.test.ts` drives the
real Server Actions against real local auth: a weak password returns a
field error AND provably never lands (sign-in with it still fails; the
original still works); a malformed business_email returns a field error
and writes nothing. Verified by mutation: reverting the action file
fails 3 of 5 cases.

### S8.12 · /api/search-log: handled 204s + the missing app-layer rate limit (H-5)

**What:** the route's empty/malformed-input responses are now a bare
`new Response(null, { status: 204 })`, and the endpoint is wrapped in
`rateLimit()` (30/min per client key) ahead of body parsing.

**Why:** `NextResponse.json({...}, { status: 204 })` throws — 204 is a
null-body status — and the catch block re-executed the same illegal
construction, so every empty or malformed POST became an uncaught 500.
No user impact (the caller fire-and-forgets), but it polluted logs with
fake 500s that mask real errors. Separately, this was the only
unauthenticated write endpoint with no `rateLimit()` call, violating
the stated two-layer rule (the DB trigger caps the table at 1000/min
globally; the app layer caps per-IP bursts).

**Tripwire:** `tests/probes/h5-search-log.test.ts` invokes the real
route handler: empty term and malformed JSON resolve to bodyless 204s
(previously: rejected), a valid term persists, and the 31st burst
request from one IP gets a 429 with Retry-After. Verified by mutation:
the pre-fix route fails 3 of 4 cases.

### S8.13 · HostAvatar folded into the shared Avatar primitive (M-17)

**What:** the event page's host identity avatar now renders through
`app/components/Avatar` (`src` prop) instead of a private `HostAvatar`
wrapper; the wrapper is deleted.

**Why:** the wrapper flipped container shape on data presence — a
rounded-xl `object-contain` square when a logo existed, the circular
`Avatar` fallback when it didn't — bypassing the primitive's `src`
path, which already handles images with the design system's
`rounded-full` + `object-cover` rules. Shape depending on data
presence is exactly the drift the shared primitive exists to prevent.

**Tripwire:** an e2e case in `e2e/discovery.spec.ts` loads a seeded
event whose director has an org logo and asserts the host avatar image
is `object-cover` inside a `rounded-full` shell. Verified by mutation:
restoring the old wrapper fails it.

### R2.5 · user_teams "permission denied" — probe locks the grant contract; step-3 delete checked

**What:** Round-2 #5 ("permission denied for table user_teams" on ED
onboarding step 3) root-caused to the postgres-default-privileges grant
gap already fixed by migration 20260718000005 — the live demo hit it
during the window when its DB stopped at 20260718000003. No new
migration needed: fresh-DB grants verified correct locally, and anon
probes against the hosted demo confirm the grant is present there now
(INSERT fails on RLS, not privilege). Added
`tests/probes/user-teams-grants.test.ts` (own insert/read/delete
allowed; cross-profile insert/read/delete denied) and surfaced the
previously swallowed `user_teams` delete error in `saveStep3`.

**Why:** the probe suite had no coverage on user_teams at all, so this
grant class could regress silently — onboarding step 3 was the only
detector, and only when a user actually filled team slots: the
replace-all delete's error was discarded, which is exactly why
attendees who skipped teams never saw the break while EDs filling
teams did.

**Tripwire:** verified by mutation both ways — `revoke insert on
user_teams from authenticated` fails 3 of 4 cases; loosening
`p_user_teams_self` to `using (true) with check (true)` fails 2 of 4.
Restored state green.

**Demo follow-up (out of scope here):** seeded @example.test accounts
500 on sign-in against the hosted demo (GoTrue chokes on SQL-seeded
auth.users rows missing the non-null token columns); bogus creds get a
clean 400, so auth itself is healthy. Needs a seed.sql fix + re-seed.

### R2.7 · Gender search: "both" is a union value, not an opaque tag

**What:** the search gender facet expands its match set instead of a
literal `IN`: selecting Both matches boys-, girls-, and both-tagged
events, and a coed ("both"-tagged) event now also satisfies a Boys or
Girls search.

**Why:** Round-2 #7 — "Both" returned nothing because no seeded age
group is literally tagged 'both'. Fixing only the reported direction
would leave the mirror asymmetry (a coed event invisible to a Boys
search) which reads as the same bug. The symmetric union is the only
coherent semantic for "events my team can attend". Alternative
(rejected): make Both mean "has BOTH boys and girls rows" — that's an
intersection nobody asked for and still hides coed events.

**Tripwire:** `tests/probes/search-gender-both.test.ts` seeds
boys/girls/coed events and pins all three directions + a no-filter
control. Verified by mutation: reverting to the literal `IN` fails 3
of 4 cases.

### R2.9 · Modal focus-on-open effects must not depend on callback identity

**What:** FilterDrawer's open-effect (Escape listener + body-scroll
lock + initial ✕ focus) now depends only on `open`; `onClose` rides a
ref. Same treatment for ConfirmDialog's mount effect.

**Why:** Round-2 #9 — typing in the drawer's distance box patched the
filter state upstream, the parent re-render handed FilterDrawer a
fresh inline `onClose`, and the effect re-ran `closeRef.current?.focus()`
— stealing focus to the ✕ after every keystroke. Not a remount: the
input's state survived; only focus moved. Any modal whose
focus-on-open effect lists a callback prop in its deps has this class
of bug (EventSearchOverlay already did it right with `[open]`).

**Tripwire:** e2e "filter drawer distance box keeps focus across
keystrokes" types 6 chars and asserts focus + full value. Verified by
mutation: restoring `[open, onClose]` deps fails it.

### R2.1 · Contact success card scrolls itself into view

**What:** ContactForm's SuccessCard runs a mount effect —
`scrollIntoView({ block: "center" })`.

**Why:** Round-2 #1 — submitting swaps the ~1.4k-px form for a short
card; on stacked (sub-lg) layouts the browser clamps the stranded
scroll offset to the new page bottom, so the user lands on the footer
with the confirmation ~100px above the fold (measured 768×540:
heading at −99px, scrollY pinned to exactly docHeight−viewport). The
card owns the scroll because only it knows it replaced the form.

**Tripwire:** e2e "contact submit keeps the confirmation in view"
(768×540, pre-scrolled to bottom) asserts the heading is in the
viewport. Verified by mutation: emptying the effect fails it.

### R2.12 · Global focus ring must not carry `border-radius: inherit`

**What:** dropped `border-radius: inherit` from the `*:focus-visible`
rule in globals.css; the outline follows the element's own radius
natively.

**Why:** Round-2 #12 — `inherit` replaced the FOCUSED element's radius
with its parent's. The sort-by `<select>` (rounded-[10px] inside a
plain label) went square while focused and snapped back on blur;
Chromium marks a clicked <select> :focus-visible, so mouse users saw
it too. Every rounded control inside a square wrapper had the same
latent glitch on keyboard focus. The line predates evergreen outline
radius-following and served no purpose current browsers need.

**Tripwire:** e2e "sort-by select keeps its border-radius while
focused" asserts computed border-radius 10px before and during focus.
Verified by mutation: re-adding the line fails it.

### R2.4 · Date entry is a masked mm/dd/yyyy input, not native `type="date"`

**What:** new `USDateText` / `USDateField` primitives
(app/components/ui/USDateInput.tsx): visible text always mm/dd/yyyy,
progressive slash mask, forms/callers receive ISO (hidden input or
`onIsoChange`, "" until the date is complete AND real). Swapped in on
the onboarding DOB and both filter-drawer date boxes.

**Why:** Round-2 #4 — native date inputs render their placeholder in
the BROWSER's locale (a UK browser shows dd/mm/yyyy whatever the page
does); there is no attribute to force US format, so a masked text
input is the only reliable fix. Trade-off, accepted: those fields lose
the native calendar popup — fine for a DOB (typing beats scrolling
back decades) and for filter dates (presets cover the picker cases).
ED dashboard forms (EventForm dates) intentionally keep native pickers
— internal tooling, calendar genuinely useful there.

**Tripwire:** unit tests pin the mask + both conversions (leap day,
Feb 30, month 13); onboarding e2e types US format through the real
wizard (advance + under-18 block) and asserts the mm/dd/yyyy
placeholder; drawer e2e asserts mask formatting + preset adoption
through the controlled ISO prop.

### R2.10 · Search loading = dim + floating "Searching…" pill, not skeletons

**What:** while a results fetch is in flight, EventsSearch overlays a
centered white pill (tg-spin ring + "Searching…") over the dimmed
results; pointer-events-none so stale results stay clickable.

**Why:** Round-2 #10 — the opacity dim alone read as "nothing is
happening"; the only signal was the "…" in the events-count chip.
Skeleton cards were rejected: results usually resolve in well under a
second locally, and the page deliberately KEEPS the previous results
during a fetch (S8.8 error-preserving behavior) — skeletons would
throw that context away. Also corrected STYLE-GUIDE §5: it listed a
Spinner primitive that was never built.

**Tripwire:** e2e holds /api/events/search for 1.2s via route
interception and asserts the pill is visible mid-flight and hidden
after resolve.

### R2.3 · Signup success is a redirect to /signup/verify-email, not a banner

**What:** `signupAction`'s confirmations-on branch redirects to a new
standalone screen (AuthShell + mail icon + 3-step next-steps + sign-in
CTA) instead of returning `{ info }`; the in-form green SuccessBanner
and the reset-on-success key-remount are removed as dead code. The
session branch (local dev) still goes straight to /onboarding, and
failed submits still preserve typed values.

**Why:** Round-2 #3 — after "Account created" the user sat on the
emptied signup form, which read as "did that work?". A dedicated
screen makes the state unambiguous. No email address rides the URL
(privacy rule: nothing personal in query strings), so the copy is
generic. Reset-on-success is now trivially true: the form unmounts.

**Tripwire:** probe `signup-verify-redirect` drives the real action
(mocked auth client): no-session → NEXT_REDIRECT /signup/verify-email,
session → /onboarding, invalid input → field errors with no redirect;
reverting to the banner return fails it. e2e renders the screen.

### R2.2 · Contact success card: expectation + next actions, heading rides the form

**What:** richer "Message sent!" state (halo badge with send accent,
"typically reply within 1–2 business days" chip, Browse-events primary
CTA + Back-to-home ghost). The card's "Send us a message" heading +
subtitle moved from the page into ContactForm so they swap out with
the form — the old layout kept "Fill out the form…" above the success
card.

**Why:** Round-2 #2 asked for a more engaging confirmation; the
useful upgrades are a reply-time expectation and somewhere to go next
(the product's core action), not decoration.

**Tripwire:** contact e2e asserts the reply-time chip + Browse-events
CTA on the success state; screenshot-verified at card level.

### R2.6 · Step-3 team slots: numbered card + progressive disclosure

**What:** Team 1 renders as a card with a numbered-badge header;
Teams 2–3 sit behind native `<details>` "+ Add Team N · optional"
affordances that auto-open when a failed submit preserved their
values. Fields split into TeamSlotFields; the form contract
(team_N_gender/age/level radios + selects, uncontrolled) is unchanged
— collapsed slots simply post empty values.

**Why:** Round-2 #6 — three identical always-expanded cards read as a
wall of controls on an all-optional step. Native <details> keeps the
disclosure dependency-free and the inputs in the DOM, so no client
state or serialization changes.

**Tripwire:** ED onboarding e2e asserts Team 1 + "Add Team 3" visible,
expands Team 2, fills both, and verifies the exact user_teams rows
land via the service role. Screenshot-verified.

### R2.11 · Broken remote images unmount to fallbacks (SafeImg)

**What:** new `SafeImg` primitive (ui/SafeImg.tsx): an `<img>` that
swaps to a caller-supplied fallback on load error, keyed by src so a
changed URL retries. Adopted at every DB/remote-URL image site — both
Avatars (→ initials), EventCard + card-bits + EventSearchOverlay +
event-page hero/photos/sponsors, SpotlightColumn, activity/favorites
thumbs, director pages, testimonials. DirectorPortrait already had its
own onError and stays. EventCard's logo also moves OFF next/image:
logos live on arbitrary per-event hosts and the optimizer only accepts
allow-listed hostnames (same reasoning parts.tsx already documented),
so next/image there was a latent crash for real ED-supplied URLs.

**Why:** Round-2 #11 — seeded and future dead URLs (two seed unsplash
photos 404 today) painted the browser's broken-image glyph over
otherwise-designed fallbacks. The fix is one mechanism at the leaf,
not per-site patches; "no image" and "broken image" now render
identically.

**Tripwire:** e2e loads /events, confirms unsplash logos render, then
aborts all unsplash requests and asserts every such <img> unmounts.
Verified by mutation: no-op'ing SafeImg's onError fails it.

### R2.13 · Wide list cards reflow the rating pools; the reposition is Danny's call

**What:** featured cards' Coach/Attendee pools switch from a stacked
`items-stretch` column to a single row via a container query
(`@4xl:` = card ≥ 56rem — map-hidden list cards only; map-visible
~800px cards and grid cards stay stacked). Coach still leads.

**Why:** Round-2 #13 — with the map hidden the stacked pools
stretched into ~900px strips. Reflow uses the width instead of
capping it, and a container query keys off actual card width, not
viewport. NOT BUILT (explicitly Danny's decision, do not build
speculatively): the deeper reposition — Claim CTA under the logo,
host/location moved under the title (the truncation the reporter also
saw lives there).

**Tripwire:** e2e at 1440px asserts the pools are stacked with the
map visible and share a row after "Hide map". Verified by mutation:
removing the @4xl classes fails it.

### SEED.1 · Demo seed: GoTrue-complete auth rows + true re-run idempotency

**What:** the `auth.users` insert in `supabase/seed.sql` now sets the
eight GoTrue token columns (`confirmation_token`, `recovery_token`,
`email_change`, `email_change_token_new`, `email_change_token_current`,
`phone_change`, `phone_change_token`, `reauthentication_token`) to `''`
and pairs every user with an `auth.identities` row (email provider,
`identity_data` carrying sub + email, derived from the users insert so
ids can't drift); the cleanup preamble deletes the fixed-UUID demo rows
in dependency order before `auth.users`; the final sync recomputes all
three platform counters instead of one. The fixed UUIDs stay — the rest
of the seed references them as owner/author ids, which is why the rows
are raw-inserted rather than created via the Auth admin API (it cannot
set a chosen id).

**Why:** GoTrue scans those columns as non-null Go strings — rows
inserted with their `NULL` column defaults make every
`signInWithPassword` for that account return a 500
`AuthRetryableFetchError`, which is exactly what the hosted demo did
for all `@example.test` accounts (verified 2026-07-18; bogus
credentials still returned a clean 400, so GoTrue itself was healthy).
Reproduced locally from a clean reset on the old seed: HTTP 500
`unexpected_failure` "Database error querying schema", with the GoTrue
log naming the mechanism — `sql: Scan error on column
"confirmation_token": converting NULL to string is unsupported`. The
test suite never caught it because every test creates users through
the Auth admin API (which fills in GoTrue's internals), never through
seed.sql.
Separately, the old preamble's single `delete from auth.users` never
actually made re-runs safe: reviews and tournaments survive account
deletion (author/owner FKs are `on delete set null`), so their fixed
UUIDs collided on re-insert — and the delete itself died mid-cascade,
because `trg_helpful_count`'s UPDATE on reviews trips the
`reviews_promo_fk` re-check at the point where the promo row is already
deleted but its SET NULL action hasn't run. Deleting reviews first,
then tournaments, then users sidesteps both. The S8.1 counters only
ever increment (deliberately durable), so a delete + recreate cycle
must recompute them from live rows.

**Tripwire:** probe `tests/probes/seed-accounts.test.ts` signs in as
one seeded attendee, ED, and admin via the password grant and asserts a
session + an `email` identity — the only suite coverage of
seed.sql-created accounts. Verified by mutation: nulling
`confirmation_token` on one account fails exactly that account's test.
Also verified manually: `supabase db reset` followed by two consecutive
`psql -f supabase/seed.sql` runs into the live DB — 0 errors, row
counts stable at exactly one seed's worth (10 users / 5 tournaments /
9 events / 6 reviews), 10 identities, counters exact, all 10 accounts
sign in with HTTP 200.

### R2.11b · SafeImg catches image failures that beat hydration

**What:** SafeImg's `<img>` gets a mount callback-ref that flips to the
fallback when the element is already dead (`complete === true` with
`naturalWidth === 0`), alongside the existing onError. ui/Avatar and
DirectorPortrait drop their private onError/state and render through
SafeImg, so the class has exactly one implementation.

**Why:** the "broken logo" e2e failed with 6 unsplash imgs surviving.
DOM inspection showed all 6 WERE SafeImg-rendered with dead fetches —
and re-assigning src post-hydration made all 6 unmount, proving the
handlers were attached but the original error events fired BEFORE
hydration on the server-rendered page and never re-fired. Real product
gap, not a test artifact: any URL that 404s faster than hydration left
a permanent broken glyph. onLoad's mirror (already-loaded images) needs
no handling — a loaded img simply stays.

**Tripwire:** the existing e2e (abort unsplash before goto, scroll the
page, expect zero unsplash imgs) now exercises exactly this race.
Verified by mutation: removing the ref check (keeping onError) fails
it; restored, 14/14 discovery + 63 e2e + 285 vitest green.

### S9.1 · Demo schema drift closed at the pipeline (auto-migrate workflow)

**What:** `.github/workflows/demo-migrate.yml` — a `workflow_run`
listener that fires when the CI workflow completes successfully for a
push to `rebuild`, checks out the exact CI-validated commit, and runs
`supabase db push --db-url "$SUPABASE_DEMO_DB_URL"` (CLI pinned 2.98.2,
same as ci.yml). Concurrency-serialized; read-only GITHUB_TOKEN; the
target lives ONLY in the repo secret, never in the file.

**Why:** Vercel deploys code, not DB — the hosted demo drifted behind
supabase/migrations/ twice, producing demo-only bugs (empty search;
the R2.5 "permission denied for table user_teams" window). Gating on
CI's conclusion means a red build can never migrate the demo, and
`db push` applying only pending migrations makes re-runs no-ops.
Deliberately NOT included: seeding — `--include-seed` would drop and
replace demo data, so reseeds stay manual (DEPLOYMENT §10). Chose
`--db-url` over link+access-token: one secret, no `supabase link`
(which this repo bans as a foot-gun), no third-party auth surface.

**Verification:** YAML parse + scripted assertions on the gate
(conclusion/event/head_branch), the pinned CLI, the single supabase
command line (no seed flag, secret only via env). First live run needs
the secret set — Danny verifies run #1 in Actions.

### S9.2 · Event base row writes with INSERT/UPDATE, never `upsert`

**What:** `saveEvent` no longer writes the base event row with a single
`upsert`. It branches: `.insert(row)` for a new event, and
`.update(row).eq("id", eventId)` for an existing one. The `id` never
travels in the payload.

**Why:** PostgREST compiles `upsert` to `INSERT … ON CONFLICT (id) DO
UPDATE SET <every payload key> = excluded.<key>`, and the edit path put
`id` in the payload so it landed in the SET list. `id` is deliberately
absent from the events UPDATE column grant (000002 / 000005) — allowing
a client to repoint a row's primary key is not an edit — so Postgres
denied the whole statement: "permission denied for table events". Every
event EDIT and every publish-an-existing-draft failed; only creation
worked, because a new event carries no `id` and therefore no SET entry
for it. The fix keeps the grant tight and changes the caller instead.

**Alternative rejected:** granting `update(id)` on events. That would
let any owner rewrite a row's primary key — a far worse trade than
splitting one call into two.

**Verification:** `tests/probes/event-edit-grants.test.ts` drives the
real action as a real ED (update-intent save persists; publish flips
lifecycle to active; a direct `update({id})` is still denied).
Mutation-verified: restoring the `upsert` fails 2/3 with exactly
"permission denied for table events".

**How it hid:** no e2e covered the ED edit/publish path — only creation.
Coverage gap recorded in docs/TESTING.md.

### S9.3 · Dropped WRITE errors — failures must reach the caller

**What:** `firstWriteError(results, context)` in `lib/supabase/unwrap.ts`
— the write-side sibling of `unwrap`. It returns the first failure in a
batch as a message (Server Actions report through their return value,
so it yields a string rather than throwing) and logs it. Applied to
`saveEvent`'s replace-all child deletes + inserts and `duplicateEvent`'s
child reads + inserts; the read-drives-write sites in the same paths
(caller role, `is_premium` cap, existing `tournament_id`) now return
their error instead of degrading to a default.

**Why:** these batches fanned out through `Promise.all` and nobody read
the resolved array, so a failed write reported success. It is worse than
the read-side class (S8.9): replace-all deletes then inserts, so the
delete half can land while the insert half fails — the collection is
gone AND the ED is told the event saved. The read-drives-write sites are
the same failure wearing a different hat: a failed role read made an
admin look like an ED and stamped `owner_id`, making the event
permanently unclaimable.

**Known limitation (accepted, not fixed here):** the replace-all is
still not atomic. Surfacing the error tells the ED to re-enter the
collection; it does not roll the delete back. Making it transactional
needs a SECURITY DEFINER RPC that takes the whole event graph — a real
rework, deliberately out of scope for an error-handling pass. Revisit
if partial saves show up in practice.

**Verification:** `tests/probes/write-error-surfacing.test.ts` breaks
ONE table for ONE verb through a proxy, so the delete batch and the
insert batch are pinned separately (breaking the table outright always
trips the delete first and leaves the insert batch untested).
Mutation-verified in three passes — unchecked deletes, unchecked
inserts, unchecked duplicate — each failing exactly its own tripwires.

### S9.4 · faq_audiences + updateTeams replace-all errors surfaced

**What:** the two remaining paths the S9.3 class named. `upsertFaq`
checks its `faq_audiences` delete + insert (and the duplicated
create/edit insert branches collapse into one, since validation already
guarantees a non-empty audience list). `updateTeams` checks the
`distance_pref` profile update and the `user_teams` clear.

**Why:** an FAQ that saved with its audience insert dropped is visible
to nobody; a dropped `faq_audiences` delete on edit keeps showing the
FAQ to audiences the admin just removed, because the insert stacks on
top of the survivors. `updateTeams` reported "Team info updated." with
the distance preference never written.

**Testing note (matters for anyone extending this):** the `user_teams`
delete tripwire has to use the CLEAR-ALL case. With a slot still filled,
the re-insert collides with the surviving row on the unique-slot index
and the ALREADY-checked insert reports that error — so the test passes
against unchecked-delete code and proves nothing. Caught by mutation:
the first version of that test survived its own mutation. Clear-all
leaves the delete as the only write.

### S9.5 · Dropped-WRITE sweep — the sibling sites

**What:** the rest of the class cc catalogued, closed against the two
contracts S9.3 set. REJECT (the caller must know): `flagContent`'s
`content_hidden` upsert; `saveComment`'s prior-owner-reply delete;
`saveReview`'s existing-review lookup and its published-status read;
`toggleFavorite`'s favorited lookup; `sendPromoEmails`' prior-promo
lookup and its void-prior update. LOGGED DEGRADE (must not break the
surface, must not be silent): `recordRecentView`, `/api/search-log`,
and `claim_promo` on the promo landing.

**Why the split:** rejecting is right when the user can act on the
failure. It is wrong where the write is incidental to a page render
(view history) or where the response is deliberately uniform for
anti-enumeration (promo claim) — there, a throw would break a working
page or leak token validity. Those log instead, per `unwrapRowsLogged`.

**Two sites got bespoke handling.** `sendPromoEmails`' "mark CSV
approved" runs AFTER the emails are dispatched, so a bare error would
read as "nothing happened" and invite a re-send — which voids and
re-issues every code. It logs and appends an explicit
do-NOT-re-send warning to the returned info instead. `/api/search-log`
stays fire-and-forget for the caller but stops answering `ok: true`
for a row that never landed (204 + log).

**Testing note:** two of these tripwires initially passed under
mutation because a LATER write failed anyway and produced a truthy
error — `toggleFavorite` (stray INSERT hits the primary key) and
`saveReview` (the update fails on its own). Both now assert the
specific broken relation, not merely that some error came back. Same
lesson as S9.4: a write-error tripwire must pin WHICH write failed.

**Coverage note:** `saveComment`'s owner-reply delete and the
`sendPromoEmails` sites are one-line instances of the same checked
pattern but have no dedicated tripwire — their fixtures (owner-reply
threads, a CSV + Resend dispatch) cost more than the guard is worth
right now. Flagged here rather than left implied.

### RG10.1 · Search distance filter — supersedes S5.2

**Supersedes `S5.2 · Map + distance-from-me deferred`.** Both halves of
that deferral have landed: the Leaflet/OSM map, and now the distance
filter, which is verified rather than merely present.

**What was actually left.** The filter was already built end to end
(tier ladder in `lib/geo.ts`, bbox + Haversine in `searchEvents`, the
URL round-trip in `taxonomy.ts`, the origin input + prompt in
`FilterDrawer`, profile pre-apply in the events page). It had **no
tests and no spec for its origin rules** — so this entry closes the
verification gap, not a build gap.

**Origin precedence** (now written down in SPECIFICATION §5.2): an
explicit URL `dist`/`lat`/`lng` wins (including the `dist=any` reset
marker); else a signed-in user's geocoded profile location + saved
`distance_pref`; else the modal's Places input for anon / no saved
location. A text-only profile location is skipped — coordinates in the
DB always came from a picked suggestion.

**Two deliberate calls.** (1) The tier buttons stay ENABLED with no
origin, showing "Pick a location above" instead — disabling them would
force the user to choose location before radius. The filter is inert
until miles + lat + lng are all present. (2) Events without coordinates
are excluded from an active distance filter (the `gte/lte` prefilter
drops NULLs) but list normally when it is off.

**Not pinned, on purpose:** an event sitting EXACTLY on a threshold.
The inclusive/exclusive margin there is ~1e-13 miles — below the float
noise of a lat/lng round-trip through PostgREST — so such a fixture
flips at random. `<=` vs `<` at an irrational boundary is not a
distinction a user can observe; the 149/151 straddle is what matters
and is pinned.

**Verification:** `tests/probes/search-distance.test.ts`, mutation-
verified three ways — a wrong Earth radius (6 failures), distance
replacing rather than intersecting the facet sets (4), and a too-narrow
bounding box (4).

**Still open (not distance):** `searchEvents`' bbox prefilter has no
explicit limit, so it rides PostgREST's default 1000-row cap. Harmless
at current volume; revisit before the event count approaches it.

### S10.1 · Tournament/event writes gated on being an event host

The RLS write policies on `tournaments` and `events` asked only *"is
this row yours?"* — `owner_id = auth.uid() or is_admin()` — and never
*"are you a role that may host events at all"*. An attendee satisfies
the ownership half simply by writing their own id into the payload, and
`owner_id`, `claimed`, and `lifecycle` are all in the `authenticated`
INSERT/UPDATE column grants. The full chain was reachable straight
through PostgREST, with no server action in the path:

1. INSERT a tournament with `owner_id` = self → allowed
2. INSERT an event under it with `lifecycle='active'` → allowed
3. anon reads it (`p_events_read`: `lifecycle <> 'draft'`) → **public**

So any attendee could inject arbitrary published listings into public
discovery. The only thing standing in the way was the
`user_type === 'attendee'` check inside the `createTournament` server
action — an affordance, not a boundary, exactly the shape of C-1 where
write grants on the `public_*` views were the sole control.

**Fix** (migration `20260719000001`): new `is_event_host()` predicate
(STABLE SECURITY DEFINER, mirroring `is_admin()`) = `user_type in
('event_director','admin')`, ANDed into both write policies. Since
`is_admin()` implies `is_event_host()`, the admin branch is unchanged —
admins keep creating unclaimed rows they don't own (S1.1) and EDs still
manage only their own. The event child tables (`event_age_groups`,
`sponsors`, …) delegate to the parent event's owner check, so they are
transitively covered: an attendee can no longer own an event to hang
children off.

**Scope note.** The tier columns (`is_premium`, `is_general_ad`) were
already withheld from the column grants, so this was never a route to
Featured/Spotlight placement — ordinary public listings only.

**Verification:** `tests/probes/event-host-write-gate.test.ts`, 7 tests,
mutation-verified — reverting both policies to the ownership-only
predicate fails the 3 create-path tripwires (tournament insert, event
insert, and the anon-discovery chain) while the ED/admin positive cases
stay green, confirming the fix is what closes the hole and not an
incidental deny.

**Alternative considered:** enforcing the role check only in the server
actions. Rejected on the project's own rule — RLS is the security
boundary; a check that a direct PostgREST call bypasses is not a gate.

### S10.2 · Event writes are authorized against the parent tournament

`p_events_write` validated the event row's own `owner_id` but never
asked whether the caller may write the tournament the event hangs off.
Both `owner_id` and `tournament_id` are caller-supplied, so ED-B could
INSERT an event with `owner_id` = self and `tournament_id` = ED-A's
tournament, and the policy was satisfied — the row is "yours", so it
passed. Reparenting an existing own-event onto ED-A's tournament worked
the same way.

**Why it matters beyond tidiness.** `recalc_tournament_ratings`
aggregates every published review reachable via `events e where
e.tournament_id = <tournament>`. A grafted event therefore rolls its
reviews into the victim tournament's `general_rating`, `coach_rating`,
`attendee_rating`, and every category average. An ED could attach a
poorly-reviewed event to a competitor's tournament and drag their
aggregate down, and the victim can see the row (tournaments are
public-read) but cannot edit or remove it, because they don't own it.

**Fix** (migration `20260719000002`): `p_events_write` additionally
requires `exists (select 1 from tournaments t where t.id =
events.tournament_id and (t.owner_id = auth.uid() or is_admin()))` in
both USING and WITH CHECK. `tournament_id` is NOT NULL, so the EXISTS is
unconditional without stranding parentless rows.

Resulting matrix: ED → own tournament ✓; ED → another ED's ✗; admin →
anywhere ✓ (incl. editing an event on a claimed ED tournament, per the
S1.1 addendum); ED → unclaimed admin-created ✗ — claim it first, which
matches S1.1 and the parked claim-ownership model. Ownership transfer is
unaffected: `approve_claim_request` is SECURITY DEFINER and bypasses RLS.

**Verification:** `tests/probes/event-parent-tournament-gate.test.ts`,
6 tests, mutation-verified — dropping the parent EXISTS fails the 3
attack-path tripwires (insert, reparent, rating pollution) while the 3
ED/admin positive cases stay green.

### S10.3 · CRITICAL — SECURITY DEFINER guards were bypassable by anon (NULL auth.uid)

Six destructive SECURITY DEFINER functions guarded themselves with

```sql
if not (is_admin() or <owner> = auth.uid()) then
  raise exception 'not authorized' using errcode = '42501';
end if;
```

For anon, `auth.uid()` is NULL, so `<owner> = auth.uid()` evaluates to
**NULL, not false**. `false or NULL` → NULL; `not NULL` → NULL; and
`if NULL then` does not execute. The guard fell through and the body ran
with definer privileges. These functions are owned by a BYPASSRLS role,
so RLS offered no backstop, and 20260718000005's blanket function grants
had given `anon` EXECUTE on all six.

**Proven on the local stack:** an anon client holding nothing but the
public anon key called `delete_tournament` on a claimed tournament and
permanently destroyed it *and* its child events, with no error returned.

Affected: `delete_tournament`, `delete_event`, `anonymize_account`,
`scrub_profile_identity`, `soft_delete_attendee`, `delete_ed_account` —
i.e. unauthenticated destruction of any tournament/event plus
anonymize / scrub / delete of any account.
`apply_promo_to_review` and `claim_promo` were already safe: both open
with an explicit `if auth.uid() is null then raise`.

**Why it hid.** An authenticated non-owner has a real `auth.uid()`, so
the comparison is false, the predicate is true, and the exception raises
correctly. `c2-definer-guards` tests exactly that caller, so it stayed
green. Only the NULL/anon case slipped through. `delete_tournament` also
only broke on CLAIMED tournaments — for an unclaimed one the preceding
`v_owner is null and not is_admin()` guard does fire — so the bug bit
precisely the rows worth protecting.

**Fix** (migration `20260719000003`), two layers, because the grant
layer has already been re-widened once by a blanket migration and the
guard is the real boundary:
1. An explicit `auth.uid() is null` check at the top of each function,
   matching the pattern the two safe functions already use.
2. The ownership predicate rewritten as
   `if (is_admin() or <owner> = auth.uid()) is not true then` so a NULL
   can never again read as authorized.
Then `revoke execute ... from anon` on all six — every one requires a
session by definition.

**Verification:** `tests/probes/definer-null-uid-guard.test.ts`, 7 tests.
Each asserts the call is refused AND that the target data survived — a
revoke alone satisfies the first half, so the survival assertion is what
actually pins the guard. Mutation-verified in three states: (a) anon
EXECUTE re-granted with the guards fixed → still 7/7 green, proving the
guard alone suffices; (b) all six reverted to the NULL-unsafe predicate
with anon granted → all 6 attack tripwires fail while the legitimate
owner-delete stays green; (c) a partial revert that left `delete_event`
fixed → only 3 fail, because `delete_tournament` calls `delete_event`
and the inner guard aborts the transaction transitively. (c) is why the
mutation had to revert all six at once to be meaningful.

**Follow-on:** the backlog's "20260718000005 function-grant overreach
re-opened ~14 RG1-locked functions" item is the same root; this closes
the six destructive ones. The remaining re-opened functions still want
the grant trim Danny flagged.

### S10.4 · Storage buckets + RLS (supersedes S1.2, S3.1)
Supersedes the URL-field deferrals S1.2 (event/logo/image uploads) and
S3.1 (promo CSV). Migration 20260719000004 defines three Supabase
Storage buckets in SQL (so the demo-migrate `db push`, S9.1, provisions
them) with RLS on `storage.objects`:

| bucket | vis | limit | mime | holds |
|---|---|---|---|---|
| `event-images` | public | 10 MB | png/jpeg | event logos, sponsor logos, gallery |
| `org-logos` | public | 5 MB | png/jpeg | org logos, profile photos |
| `promo-csv` | **private** | 2 MB | text/csv | coach-email CSVs |

**Path convention — key by uploader user id** (`<auth.uid()>/<file>`).
Two reasons: (1) it sidesteps the chicken-and-egg of event-scoped keys —
an event logo is uploaded *before* saveEvent creates the event row, so
the event id isn't available; the user id always is. (2) It gives a
one-line ownership test, `(storage.foldername(name))[1] = auth.uid()::text`,
with no cross-table lookup. A user writes only under their own folder;
a non-owner cannot; admin (via `is_admin()`) writes anywhere. That is
exactly the required "owner/admin only to their own paths" guarantee,
and an ED referencing their own uploaded image from any of their events
is fine since they own those events.

**Server-side type + size limits** are the bucket's `file_size_limit` +
`allowed_mime_types`. These are enforced by the Storage API, not the
file-picker `accept`, so a crafted client cannot bypass them. Per-field
granularity comes from bucket separation (org-logos 5 MB vs event-images
10 MB). CSV row cap (≤1000) stays enforced by the parse in `submitCsv`.

**Private-CSV isolation**: the bucket is `public=false` (public CDN
endpoint dead) and the SELECT policy requires ownership/admin, so anon
and non-owners cannot download or list. Retrieval is a short-lived
signed URL minted server-side by the owner/admin (who hold SELECT).

**NULL-safety**: `auth.uid()` is NULL for anon → the folder predicate is
NULL → the row is excluded. That is correct default-deny for an RLS
USING/CHECK expression (unlike the plpgsql `if not (...)` guard trap of
S10.3 — a policy filters NULL rows out, a plpgsql `if` runs the body).

**A real griefing vector found + closed while proving this**: the DELETE
policy is the SOLE guard for cross-owner deletes — the storage service
independently blocks cross-owner *overwrites* (via the `owner` column)
but NOT deletes. Without the folder check on DELETE, any ED could wipe
another ED's logos/images. The probe asserts object *survival* after a
non-owner delete (Storage `remove` returns no error even when RLS
filters the row).

**Verification**: `tests/probes/storage-rls.test.ts`, 20 tests, drives
the real Storage API. Mutation-verified against 8 independent
weakenings — promo-csv made public (3 fail), CSV read policy widened (3),
CSV insert widened (2), public insert widened (3), public delete widened
(1), each bucket's mime allow-list removed (1 each), org-logos size cap
removed (1). Every guard has a tripwire; private-CSV isolation has two
(public-flag + read-policy). The probe deliberately writes FRESH object
names with `upsert:false` so a deny test is a true INSERT — an earlier
version used `upsert:true`, which routed onto pre-existing objects
through the UPDATE policy and masked a widened INSERT policy (caught
during mutation testing, then fixed).

**Alternatives considered.** Event-id-keyed paths (rejected: the
chicken-and-egg above; and it needs a cross-table lookup in every
policy). A single merged public bucket (rejected: loses per-field size
caps). Enforcing type/size only in the server action (rejected: with
browser-direct upload the action never sees the bytes, so bucket-level
limits are the true server-side control).

### S10.5 · submitted_csvs writes gated on event host + event ownership
Sibling of S10.1/S10.2. `p_csv_rw` was `ed_id = auth.uid() or is_admin()`
for every verb — ownership-only, no role check, no event check. `ed_id`
is caller-supplied and INSERT is granted to `authenticated`, so an
attendee could POST a submitted_csvs row naming themselves and dump
arbitrary addresses into `raw_emails` — a PII/spam injection into the
admin review queue (they cannot issue codes — p_promo_admin_write is
is_admin()-only — but the emails landing in the queue is the harm).
Verified locally: an attendee INSERT succeeded. The write also never
checked the CSV's event belonged to the caller (the S10.2 class).

Migration 20260719000005 splits the single `for all` policy into
verb-scoped policies: SELECT unchanged (`ed_id = auth.uid() or
is_admin()`); INSERT requires `is_admin()` OR (event host AND
ed_id = self AND owns the event); UPDATE/DELETE require `is_admin()` OR
(event host AND ed_id = self). App paths — submitCsv (ED INSERT own
premium event), reject/approve (admin UPDATE), cancel (ED DELETE own) —
all still pass.

**Verification:** `tests/probes/submitted-csv-host-gate.test.ts`, 4
tests, mutation-verified — reverting to the ownership-only `p_csv_rw`
fails the attendee-injection and cross-event tripwires while the owning
ED's legit insert stays green.

### S10.6 · Upload flow wired to the buckets (client + CSV)
Builds on S10.4. The URL text fields for DB-backed images are replaced by
the shared `ImageUploadField` (event logo, sponsor logos, gallery, org
logo, profile photo). It keeps the paste-a-URL fallback in the SAME field
and previews via `SafeImg` (dead URL → placeholder + soft warning), so no
surface loses the "paste a hosted URL" path. `lib/storage/upload.ts` does
the browser-side upload to the right bucket at `<uid>/<uuid>.<ext>`; the
value stored on the row is the public URL (rendered through `safeImageSrc`
as before). Client-side type/size checks are UX only — the bucket
(S10.4) is the server-side authority.

Promo CSV: the browser uploads the file to the private promo-csv bucket
at submit time and passes the object path; `submitCsv` stores it after
re-checking it sits under the caller's own `<uid>/` folder. `raw_emails`
stays inline (the admin queue still renders without a bucket read). The
download button now prefers the ORIGINAL uploaded file via
`getCsvSignedUrl` (a 60s signed URL, RLS-scoped to owner/admin two ways:
the row read and `createSignedUrl` both require ownership) and falls back
to regenerating from `raw_emails` for legacy rows.

**Form integration.** `ImageUploadField` is controlled, so each host form
holds the value in `useState` (seeded from the preserved submitted value
or the profile row). The visible URL input carries the field `name`, so a
plain `<form>` submits it and Playwright can drive it — an earlier draft
put `name` on a hidden input, which broke the publish e2e (the visible
input was unfillable).

**Verification:** `e2e/uploads.spec.ts` drives a REAL browser upload —
picks a PNG in the event form, asserts the logo field fills with a
`/event-images/<ed-uid>/` public URL. Storage RLS itself is proven in
`tests/probes/storage-rls.test.ts` (S10.4). The promo CSV upload rides
the existing `mutations` promo-CSV e2e.

### S10.7 · submitted_csvs UPDATE is admin-only (supersedes the S10.5 UPDATE arm)
Storage-audit follow-up. S10.5 kept a defensive owner arm on
`p_csv_update` ("no ED path updates today, keep it symmetric with
delete"). That arm was itself a hole: `status` is the admin review
verdict, so an ED could PATCH their own row to `status='approved'` via
PostgREST — skipping admin review, rendering as "Sent emails" on their
dashboard, and dropping the row out of the admin pending queue.

Considered the column-grant allow-list route and rejected it: admin and
ED both connect as the `authenticated` Postgres role, so column
privileges cannot tell them apart — only RLS can. Migration
20260719000006 drops the owner arm: UPDATE is `is_admin()` for USING and
WITH CHECK. The ED lifecycle is INSERT (submit) + DELETE (cancel while
pending), both untouched; admin paths (rejectSubmittedCsv,
sendPromoEmails→approved) untouched.

**Verification:** `tests/probes/submitted-csv-host-gate.test.ts` — ED
self-approve touches 0 rows and status stays `pending`; admin reject
succeeds. Mutation-verified: reintroducing the owner arm fails the
self-approve tripwire; restoring the migration greens it.

### S10.8 · Storage symmetry probes — overwrite + signed-URL verbs pinned
Storage-audit follow-up to S10.4; probes only, no policy change. The
S10.4 suite proved INSERT/DELETE/read isolation; the UPDATE verb and the
signed-URL mint path were asserted only from the allow side. New probes
in `tests/probes/storage-rls.test.ts`: a cross-owner overwrite
(`upsert:true` onto an existing object) and a cross-owner `update()` are
denied with the object surviving byte-identical; the owner still can
overwrite their own; a non-owner ED and anon cannot `createSignedUrl`
another's private CSV.

Finding worth keeping: the two denials live at DIFFERENT layers.
Widening the RLS UPDATE policy to any-authenticated does NOT open the
overwrite hole — the storage service's own object-owner check blocks it
independently (the inverse of deletes, where RLS is the sole guard,
S10.4). The signed-URL denial is pure RLS: widening
`p_storage_csv_read` to any-authenticated flips the non-owner mint
probe red. Mutation-verified both ways; policies restored intact.

### S10.9 · Atomic saveEvent — save_event_graph RPC (supersedes S9.3's known limitation)
S9.3 accepted that the replace-all was not atomic: a failed child insert
surfaced, but the delete had already landed, so the ED's collection was
gone and had to be re-entered. Migration 20260719000007 adds
`save_event_graph(p_event jsonb)` — SECURITY DEFINER, one transaction
for the base row + all seven child replace-alls; any raise rolls back
everything, deletes included. `saveEvent` validates as before and calls
the RPC; `duplicateEvent` reuses it with a fresh id; the in-action
replace-all is deleted (no dual path).

Entry guards per the scope doc (all the hard-won patterns): null-uid
raise + `is not true` predicates (S10.3), authz MIRRORS `p_events_write`
— `is_event_host()`, owner-or-admin on the existing row, parent-
tournament access on both the current parent (USING half) and the final
parent (WITH CHECK half) — `set search_path = public, pg_temp`, EXECUTE
revoked from public/anon. New-row ownership is computed from the
caller's role inside the RPC (admin → unclaimed claimable row per S1.1),
never from the payload — a caller-supplied owner_id would reopen S10.1.
The UPDATE arm's SET list excludes `id` (S9.2) and the ownership + tier
columns (the RPC bypasses the S6.2 column grants, so it must never
touch is_premium/is_general_ad/premium_at/aggregates).

Known behavior delta, deliberate: an admin DUPLICATING a claimed event
now yields an unclaimed claimable copy (previously the copy landed owned
by that ED). Role-computed ownership matches S1.1's admin-creates-
claimable model; the old path is unreachable in the UI (Duplicate sits
behind `canManage`).

**Verification:** `tests/probes/save-event-graph.test.ts` — authz matrix
below the action + the late-child-failure atomicity probe (poisoned
milestones roll back base row and every earlier collection).
Mutation-verified 4 ways: role guard, owner guard (isolated via a
grafted cross-owner seed), parent gate, and an exception-swallowing
milestones insert each flip exactly their own tripwire.
`write-error-surfacing` adapted: the proxy breaks the RPC call itself
and asserts error + data-survives; `event-edit-grants` (publish flips
lifecycle through the RPC now) and the tournament-crud matrix stayed
green untouched.

### S10.10 · Admin Users search covers email via an ids-only definer bridge
The admin /dashboard/users search filtered name + organization but not
email — emails live in `auth.users`, unreadable to the app's
authenticated client, so an admin couldn't find the account behind a
support request quoting only an address. Rather than plumb the service
role into the app or widen any grant, migration 20260719000008 adds
`admin_search_users_by_email(term)`: SECURITY DEFINER, admin-only
(null-uid raise + `is not true` predicate, pinned search_path, EXECUTE
revoked from public/anon), returning matching user ids ONLY — never
addresses — capped at 100 so a one-letter term can't balloon the
PostgREST `or()` URL. The page folds the ids into the existing
name/org `or()` filter; a failed lookup surfaces via `unwrapRows`
instead of degrading to name-only results (S8.9 class).

**Verification:** `tests/probes/admin-email-search.test.ts` (authz +
ids-only shape + blank-term guard; mutation-verified by dropping the
admin predicate). E2E in `dashboard.spec.ts`: an admin finds a seeded
user by email — a term no profile column carries — and Block/Delete
are reachable from the filtered row.

### S10.11 · Reviewer-details popup ships on existing grants (supersedes S2.7)
The §6.2 popup (click a Username on the dashboard reviews table → two
rating pools) was deferred in S2.7. Implemented now as
`getReviewerDetails(reviewId)` + `ReviewerDetailsDialog`: keyed by
REVIEW id (the caller must be able to see the review before the
reviewer resolves), pools computed on read from published reviews
(Verified Coach = `guru_review`, Attendee = rest, NULL-overall rows
excluded), and identity passed through EXACTLY what RLS already
exposes. Admins get the full profile + user_teams via the `is_admin()`
policy arms; EDs get the `review_author_public` view fields (first
name, org, photo) and "—" for the rest. No grant or view was widened —
the two roles simply see different depths, now stated in §6.2.

Found in passing, flagged as a separate task (not fixed here): the ED
reviews TABLE itself renders "Reviewer" for every username because its
profiles join is RLS-filtered for EDs — the §6.2 "avatar + full name"
column only works for admins, and the name search is a no-op for EDs.

**Verification:** e2e in `reviews.spec.ts` — an ED opens the popup from
their table row and sees both pool columns with the seeded review
counted in the Attendee pool (also the render proof: star rows, x.00/5,
counts). Failed reads surface as the popup's error state instead of
rendering empty pools (S8.9 class).

### S10.12 · Promo eligibility pre-flight via ids-free definer RPC (supersedes S3.2)
S3.2 shipped `validateEmails` as an everyone-eligible pass-through
because the check needs `auth.users.email`, unreadable to the app's
clients, and plumbing the service role into the app was rejected.
Migration 20260719000009 adds `promo_email_eligibility(text[])`:
SECURITY DEFINER, host-gated (`is_event_host() is not true` + null-uid
raise, pinned search_path, EXECUTE revoked from public/anon), returning
(email, status) pairs ONLY — the email column echoes the caller's own
input, so no account data crosses the boundary beyond the §6.3 verdict
itself. Verdicts, in input order (unnest WITH ORDINALITY): no account →
eligible; non-blocked coach attendee → eligible; blocked coach →
blocked; anything else (ED, admin, non-coach role, auth user without a
profile row) → wrong-user-type. Matching is case-insensitive on a
trimmed input.

`validateEmails` now calls the RPC and FAILS CLOSED: an errored check
returns `{ error }`, the Send Emails popup shows the failure and keeps
the send button disabled — it never degrades into "everyone eligible".
The popup's auto-exclude + not-re-addable handling already existed and
needed no change.

**Verification:** `tests/probes/promo-eligibility.test.ts` — authz
(anon + coach rejected, ED + admin allowed), the full §6.3 matrix in
input order, the (email, status)-only shape, and case-insensitive
echo. Mutation-verified both ways: dropping the host gate fails the
attendee tripwire; collapsing the wrong-user-type arm to 'eligible'
fails the matrix tripwire.

### S10.13 · Dead events FTS pipeline removed (TURBOCHECK H-6)
`events.search_document` + `search_vector`, their two GIN indexes,
`build_event_search_document()`, and trigger `t_events_search`
recomputed on every event write — and nothing read them: repo-wide
grep for the columns / tsquery variants / `textSearch` had zero app
hits, and real search is ILIKE over title / host_club /
location_formatted (`lib/events/search.ts`). Pure write amplification
+ index bloat on the hottest table. Migration 20260719000010 drops the
whole pipeline in dependency order (trigger → functions → indexes →
columns; `build_event_search_document` takes the `events` row type so
it precedes the column drops). Reversible via git if real FTS is ever
wired — chosen over "wire it up" because ILIKE already meets the spec'd
search behavior and nothing ranked results.

Cleanup ripples, same commit: `trg_event_search` left the c2 RG1
revocation list (the function no longer exists), SPECIFICATION §3.2 and
SCHEMA-DESIGN's events table + carry-forward inventory no longer
describe the columns, and TURBOCHECK H-6 is marked resolved.

**Verification:** schema-drift replays every app select against the
reset DB (no site referenced the columns — the "zero readers" proof),
and the full gate (typecheck, lint, build, 402 vitest, 72 e2e) is green
on the dropped schema.

### S10.14 · ED reviews table backfills reviewer names from review_author_public
The §6.2 table's `author:profiles!…` join is RLS-blanked for EDs, so
every row rendered the "Reviewer" placeholder and name search matched
nothing — while the reviewer popup (S10.11) already resolved identity
through the public `review_author_public` view. `listDashboardReviews`
now backfills null-author, non-anonymized rows from that view in one
batched read (first name + org + photo; last_name stays null), so the
table cell, name search, and CSV export all run on the same view-backed
identity the popup shows. No grant widened, no new view — admins are
untouched (their profiles join resolves first and the backfill skips
them). Chosen over widening the ED grant on profiles (breaks the
column-grant privacy line) and over an ED-specific definer RPC (the
public view already carries exactly the fields §6.2 needs).

**Verification:** e2e reviews spec — the ED sees the seeded reviewer's
real first name in the table, name search filters on it (miss → empty
state, hit → row), and the popup still opens from the name button.

### S10.15 · promo_email_eligibility input capped at the CSV row cap
The pre-flight RPC (S10.12) accepted an unbounded text[] and joined it
all against auth.users — legitimate callers can never exceed 1000
addresses because `MAX_CSV_ROWS` rejects bigger CSVs before the RPC
runs, so an oversize array is either a bug or an event host using the
definer bridge as a bulk account-status oracle. Migration
20260719000011 raises 22023 above 1000 inputs (after the authz gates,
so unauthorized callers still see only 42501). Raise chosen over
truncation: a silent trim would return a partial verdict the Send
Emails popup renders as complete.

Documented deliberately, not a leak: the per-email blocked /
wrong-user-type statuses this RPC shows an event host are exactly what
spec §6.3 mandates the popup display ("already in use by an account
with a different user type…"), and the cap now bounds how much of that
an ED can harvest per call. The breadth is spec-mandated; the cap is
the guard on abusing it at scale.

**Verification:** `tests/probes/promo-eligibility.test.ts` — 1001
inputs raise 22023 for both ED and admin; exactly 1000 still answers.
Mutation-verified: reinstalling the uncapped S10.12 body fails the
oversize probe.

### S10.16 · submitted_csvs ED DELETE narrowed to pending (rule moved into RLS)
"Only pending submissions can be canceled" was enforced solely in
`cancelSubmittedCsv`; the S10.5 DELETE arm let an owning ED delete a
row in any status straight through PostgREST. Deleting an approved row
destroys the admin's review record AND cascades away the promo_codes
audit anchor (`submitted_csv_id … on delete cascade`); deleting a
rejected row erases the verdict. Same principle as the S10.7 UPDATE
narrowing: once an admin verdict exists, the row is admin-managed.
Migration 20260719000012 adds `status = 'pending'` to the owner arm;
the admin arm is unchanged, and the app action keeps its friendlier
pre-check ("Only pending submissions can be canceled") as UX on top of
the boundary.

**Verification:** `tests/probes/submitted-csv-host-gate.test.ts` — ED
delete of approved + rejected rows touches zero rows (row survives),
pending cancel still works, admin deletes a reviewed row.
Mutation-verified: reinstalling the status-blind S10.5 arm fails the
reviewed-row tripwire.

### S10.17 · Generated Supabase types — compile-time guard for the column-drift class
`supabase gen types typescript --local > lib/database.types.ts` is now
committed, and all three client factories (`createServerAuthClient`,
`createAnonServerClient`, browser `createClient`) are typed with
`<Database>` — every uncast `.from()/.select()/.insert()/.rpc()` is
column- and enum-checked at compile time. CI regenerates the file after
`supabase db reset` and `git diff --exit-code`s it, so a migration
without regenerated types fails the build (convention in CLAUDE.md +
supabase/README.md: migration ⇒ regenerate types, same commit; the CI
CLI pin keeps output byte-stable).

The tsc wave (28 errors) was fixed without one `as any`: view reads
accept the generated all-nullable view columns and guard the key at the
loop (views drop NOT NULL); URL-sourced facet filters narrow through
the existing allow-lists (now typed predicates — `enumOrNull` in
lib/enums); dynamically-built writes are typed against the generated
`Insert`/`Update` shapes (profiles patch, user_teams rows, reviews row,
faq_audiences); duplicateEvent dropped its `Record<string, unknown>`
cast so the RPC payload type-checks against `p_event: Json`. Two small
behavior improvements fell out: tampered team/audience enum values now
return a clean field error instead of a raw DB cast error.

Scope honesty, proven with a scratch rename (events.location_lat +
user_teams.competition_level → tsc failed in the distance facet, both
team-write actions, and the reviewer popup; reverted, never committed):
the compile guard covers UNCAST sites only. The ~80 legacy
`as unknown as` casts on query results still blind tsc — a rename of a
column read only through casts (verified with reviews.helpful_count)
compiles clean. Until those casts are removed per-file as files get
touched (deliberately incremental, no big-bang sweep), the
`schema-drift` probe remains the required runtime layer, and the seed
itself catches renames of seeded columns at `db reset`.

**Verification:** full gate green on the typed clients; drift gate
proven by the scratch-rename experiment above; `git diff --exit-code
lib/database.types.ts` after a fresh regen is clean.

### S11.1 · Privacy Policy + Legal pages render client copy verbatim
`/privacy` and `/terms` replace their ComingSoon stubs with the
client-provided texts rendered **verbatim** through a shared
`LegalArticle` long-form layout (aurora backdrop, white article card,
h2 sections, bullet lists). We only structured the copy — no rewording,
including the unfilled "Website home URL" placeholder in the privacy
intro, which is the client's to fix in source text. The `/terms` route
name stays (footer + e2e already point at it) but the page titles
itself **"Legal"**, matching its own copy; the footer bottom-bar label
follows ("Privacy · Legal · Cookies"). Alternative — polishing the
copy or renaming the route — rejected: legal text isn't ours to edit,
and the route rename buys nothing.

**Verification:** e2e `discovery.spec.ts` asserts both h1s, section
headings, and body snippets render.

### S11.2 · Signup terms consent enforced in the Server Action
Signup now requires the "I agree to the Privacy Policy and Legal
Terms" checkbox (both linked, new tab). The gate lives in
`signupAction` — `agree_terms === "yes"` or an `agree_terms` field
error comes back; the checkbox's `required` attribute is only the UX
layer, and a tampered value ("maybe") counts as not agreed. The
checkbox state rides the existing `useSubmittedValues` snapshot, so a
failed submit restores it like every other field. `Checkbox.label`
widened `string → ReactNode` to host the inline links (label semantics
keep link clicks from toggling the box). No DB column: consent is
implied by the account's existence post-gate; an audit trail was
considered and skipped as scope the client hasn't asked for.

The values-preserved e2e exposed a latent gap: React applies a
`<select>`'s `defaultValue` only at mount, so the post-action form
reset blanked the role dropdown while inputs survived. Signup's role
select now remounts on the captured value (`key=`). The same
`defaultValue={values.x}` select pattern exists in EventForm,
FaqsClient, AccountClient, and OnboardingWizard — swept separately in
S11.3 so this commit stays one concern.

**Verification:** probes drive `signupAction` without/with tampered
`agree_terms` (field error, no redirect); e2e checks the box for a real
signup → onboarding, and proves the server rejects an unchecked submit
after stripping `required` client-side, with typed values preserved
(incl. the role select). Mutation check: deleting the action's
`if (!agreedTerms)` arm fails both probes.

### S11.3 · Select defaultValue survives failed submits — class sweep
The S11.2 e2e exposed that React applies a `<select>`'s `defaultValue`
only at mount, so React 19's post-action form reset blanks selects
back to their mount-time default while inputs/textareas (whose DOM
default syncs on prop change) keep the submitted value. Sweep of every
`defaultValue={values.…}` select: EventForm (region, season),
FaqsClient (status), OnboardingWizard (team age), AccountClient (team
gender/age/level) now remount on the captured value (`key=`), matching
the signup role select. Alternative — making selects controlled — was
rejected: it changes every consumer's contract for the same result.

**Verification:** the mechanism is proven end-to-end by the S11.2
signup e2e (identical one-liner, previously failing assertion); the
swept sites are exercised by the existing form journeys staying green.
No new per-site failed-submit e2e — none of those forms had one, and
the fix is mechanical.

### S11.4 · Public ED page brought up to spec (identity, sorting, comments)
Component-by-component diff of `/directors/[id]` against the Public ED
page spec found three gaps, all closed:
1. **ED picture + name** — `public_directors` already exposed them
   (EDs are business-public identities; the attendee first-name+initial
   rule does not apply) but the header never rendered them. Added an
   identity row under the org description.
2. **Events tab sorting** — the spec's "search-page options, default
   desc publish date, paid flag FIXED as the second key" was absent
   (hardcoded start-date order, no UI). Client-side sort over the
   fetched list: Recently published (default) / Most teams / Date ·
   soonest / Highest rated, each tie-broken by `is_premium` desc then
   publish date. Note the deliberate difference from search, which pins
   premium FIRST — here paid is always second, per spec.
3. **Reviews without comments** — the bespoke `ReviewItem` list is
   replaced by the shared `ReviewCard` (+ eager `CommentTree` wiring
   copied from the event page), which brings comments, helpful, flag,
   and the GURU badge in one move. `ReviewCard` gained an optional
   `eventContext` chip since profile pages list reviews across events;
   `listReviewsForEvents` (published, across an owner's events) is the
   new shared query. `getDirectorReviewRows` + `DirectorReviewRow` died
   with the bespoke list; the error-surfacing probe now pins the
   replacement query's throw path.

**Verification:** e2e drives a seeded ED page anonymously — identity
row, sort control default, reviews tab card with comments affordance
and event chip; error-surfacing probe covers listReviewsForEvents.

### S11.5 · Public attendee page + the first-name-plus-initial rule
`/attendees/[id]` ships per the Public Attendee Page spec, with the
decided name rule: PUBLIC NAME = first name + last initial ("Ashley
M."). Migration 20260719000013 recreates `review_author_public` and
`public_comment_authors` with a computed `last_initial`
(`upper(left(last_name,1))`) — `last_name` itself stays out of every
public projection — and adds `public_attendees` (attendees only,
blocked excluded; projects role_title + organization_title + city/state
deliberately, because the page spec displays them). DROP+CREATE
re-applies 000005's default write privileges, so the migration
re-revokes writes on all three views (h1 write-denial pins it).

Page: header (photo, name, city+state, role, total published, club),
"Reviews as Verified Coach" | "Reviews as Attendee" metric blocks (avg
GIVEN per capacity, coach = reviewer_role='coach', same split as
director ratings), shared ReviewCard list (comments, helpful, flag,
GURU badge, event chip) with a capacity filter. 404 for deleted /
blocked / not-onboarded users — deletion anonymizes reviews and drops
the profile row, so the page naturally vanishes (matches the
Former-member convention on cards).

Linking: attachPublicAuthors/attachPublicCommentAuthors now map
last_initial into the display name, and ReviewCard + CommentTree wrap
avatar/name in a link — attendees → /attendees/[id], comment authors
who are EDs → /directors/[id]. The ED dashboard table keeps its name
BUTTON (the reviewer popup is an existing affordance) — there the
avatar links out and the popup gains "View public profile"; the
dashboard table also intentionally keeps first-name-only display
(S10.14 backfill untouched — dashboard is not a public surface, and
its search semantics + e2e pin the current shape). The attendee
Account tab links "View public profile".

**Verification:** h1 probes — last_initial served, last_name select
errors on both reworked views + public_attendees, ED/blocked exclusion,
write-denial across all five views; e2e — page renders "Ashley U." for
a seeded attendee with the full last name absent, capacity filter
flips the list, GURU badge visible, event-page review card links to
/attendees/[id]. Types + schema.sql regenerated same commit (CI drift
gate).

### S11.6 · Unbounded .in() id lists batch through in-chunks (URI too long)
The admin Events dashboard crashed ("URI too long", error boundary)
once the local DB crossed ~220 tournaments: PostgREST `.in()` filters
ride the GET query string, the HTTP client caps URIs at ~8 KB, and the
admin scope passes EVERY tournament id. The same class sat in every
query fed by an unbounded id list. New `lib/supabase/in-chunks.ts`
(`chunkIds` / `fetchInChunks`, 150 ids per batch) now backs: dashboard
events (listEventsForTournaments + owner names + CSV export child
rows), dashboard reviews (owned-event scoping, author backfill, promo
codes — with per-chunk FRESH builders, since supabase-js builders
mutate in place and a shared one would stack filters), director
aggregates (profile + about-grid review pools), the public ED page
list (per-batch limit pages merged and re-cut), promo coaches scoping,
promo-page ED names, and promo send/void (the 1000-row CSV cap already
cleared 8 KB of emails). Sites bounded by page-size constants (facet
attach helpers, spotlight, featured) stay direct.

**Known limit, deliberately out of scope:** `lib/events/search.ts`
filters by `matchingIds` under count+range pagination — chunking that
means restructuring search pagination, so it keeps the direct `.in()`
for now and will need its own slice if facet-matched id sets approach
~200. Flagged for the backlog.

**Verification:** `tests/probes/uri-length.test.ts` seeds 260
tournaments and drives the original crash site — resolves, finds the
seeded events, and preserves the cross-batch sort (earliest-dated
event lives in the LAST batch). Mutation-verified: reverting to the
direct `.in()` fails the probe with the production error ("URI too
long"). chunkIds edge cases pinned.

### S11.7 · Search pages over the merged facet id set in app code (URI too long, part 2)
`searchEvents` was S11.6's flagged known limit: the facet child-table
matches and the distance prefilter merge into one unbounded id list,
and the count+range-paginated events query filtered it with
`.in("id", ids)` — dead at ~200 UUIDs ("URI too long"), so any facet
matching a few hundred events turned filtered search into a 500.
Chunk-and-concat can't wrap a count+range query, so the id-filtered
path now paginates in app code: the merged ids resolve to bare sort
keys (id, is_premium, start_date, general_rating,
teams_attended_prev_year, created_at) per 150-id chunk through
`fetchInChunks` — each chunk on a FRESH builder carrying every
events-table filter — the keys are ordered by an app-side mirror of
the SQL ORDER BY, `total` is the merged length, and only the requested
page (a pageSize-bounded id list) is fetched in full and re-cut to the
computed order. The facet-less path keeps the single count+range
query. Alternative (a definer RPC taking the id array as a POST body,
or SQL-side facet resolution) saves the extra round trips but
duplicates the whole filter grammar in SQL; at realistic catalog scale
(hundreds of events → 2–3 chunks) the app-side merge is simpler and
stays inside the S11.6 helper convention.

Both paths also gained `id` as a final ORDER BY / comparator
tie-break: bulk-inserted events share a statement-level `created_at`,
and without a total order equal-key rows could shuffle between page
fetches (duplicate/missing cards while paging — a latent flake in the
old SQL path too).

**Known limit, deliberately out of scope:** each facet sub-query and
the distance prefilter still ride single un-ranged GETs, so
PostgREST's max-rows cap (1000 by default) silently truncates a facet
id set once a single facet value tags >1000 events — truncation
narrows (drops events), never widens. Needs range-paged facet fetches
or SQL-side facet resolution if the catalog approaches that scale.

**Verification:** `tests/probes/search-id-batching.test.ts` seeds 260
turf events and drives the real `searchEvents`: full count, premium
tier + sort-key order preserved across chunk boundaries (the
earliest-dated event is inserted LAST, so it lives in the last chunk
yet must lead the non-premium results), three 100-row pages tile the
exact sorted order with a stable total and an empty page past the
end, and a second facet still intersects (never widens; an empty
intersection stays empty). Mutation-verified: the pre-fix code fails
the probe with the production error ("URI too long").

### S11.8 · EDs are public business identities — full name everywhere
Decided (Option A): an Event Director's full name is their public
business identity, shown wherever the ED appears — `/directors`, the
public ED page, and the event-page host row. Attendees/reviewers keep
the S11.5 "First L." rule (`last_initial`, never `last_name`) on
`review_author_public`, `public_comment_authors`, `public_attendees` —
untouched here.

The event-page gap was RENDERING, not schema: host identity already
flows from `public_directors` (full name projected since baseline)
via `getDirectorProfile`, but ContactPanel only rendered the
org-first `display_name` and never `director_name` — the personal
name vanished whenever an org title existed. The fix: the host row
now renders "Event Director · <full name>", deduped against the
org-title headline.

`public_event_owners` was never the identity source and needs no
name widening: its only consumers (featured-events + search logo
enrichment) select id + logo fields. Instead the view was NARROWED to
what its consumers read — id, first_name, org_logo_url,
profile_photo_url (first_name retained because the h1 write-denial
harness requires it in every probed projection);
organization_title / org_description were dead there too (the host
sidebar reads `public_directors`). An earlier draft of this slice
widened the view to carry `last_name` — superseded in place before
push (migration 20260720000001 edited; local DBs are disposable), per
the rule that an unused public surface is no place to carry PII. The
drop/recreate re-grants SELECT and re-revokes writes in the same file
(the S8.5 lesson).

**Verification:** `tests/probes/h1-public-views.test.ts` pins the
split: `public_directors` serves the ED's full name (the host row's
identity source) while `public_event_owners` refuses a `last_name`
select, as do `review_author_public` / `public_attendees` /
`public_comment_authors` (the comment-authors denial was previously
unpinned, now added). Mutation-verified: leaking `last_name` into
`public_event_owners` fails the probe, dropping it from
`public_directors` fails the probe, and leaking it through
`public_comment_authors` fails the attendee probe.

### S11.9 · Account deletion is a TRUE delete + recompute (Option B)

**Supersedes S6.1 (soft-delete via anonymize + scrub) and the
"anonymize and disclose" account-delete rule formerly in
SPECIFICATION §9.3.**

**What:** `soft_delete_attendee` / `delete_ed_account` now DELETE the
user's review + comment rows instead of calling `anonymize_account`
(migration 20260720000002). The existing `t_reviews_recalc` AFTER
DELETE trigger recomputes each affected event's aggregates (and rolls
up), the reviews→comments FK cascade removes threads under a deleted
review, and the S10-era purge triggers clean the moderation rows.
`anonymize_account` is dropped, the `anonymized` columns on reviews +
comments are dropped, and the two public identity views are recreated
without their anonymized CASE arms (writes re-revoked in the same
file, per the S8.5 lesson). A one-time purge deleted every
legacy-anonymized row — users who deleted under the old model — so
their events' scores are finally honest; the migration RAISEs the
count as a NOTICE (0/0 on the local dev DB; the real count surfaces
when demo-migrate applies the migration on push).

**Why:** under the old model a "deleted" user's reviews stayed
published and kept counting toward event scores — a rating no one
stood behind still moved the number EDs compete on. Product call:
content leaves with its author. The privacy/legal texts (S11.1)
never promised retention or required deletion either way — this is a
product choice, not a compliance fix.

**Deliberately unchanged:** `detached` + `snapshot_*` (event deleted,
review kept, author retained) is a different feature and keeps its
semantics; `published_reviews_total` stays a frozen "ever published"
counter (deletes never decrement — the probe pins it); profile scrub +
`blocked=true` + auth.users retention are exactly as in S6.1's second
half. Single-review self-delete already hard-deleted and is untouched.

**Read layer:** every `anonymized` branch collapsed to the `author_id`
check (`app/dashboard/reviews/*`, `app/components/reviews/*`,
`lib/reviews/queries.ts`); the defensive null-author fallback keeps
the neutral "Former member" label.

**Verification:** `reauth-delete` probe rewritten — two published
reviews by different attendees, one author deletes: rows gone, event
review_count 2→1, general_rating 4.00→3.00 (the higher rater leaving
LOWERS the score), profile scrubbed + blocked, platform counter
unchanged; plus an ED-path case. Mutation-verified: restoring
anonymize-style row survival turns the probe red. The C2 /
null-uid-guard probes retargeted off the dropped function (the
review-survival pin moved into the `soft_delete_attendee` case).

### S12.1 · Legal pages: dynamic site URL + linked brand mentions (verbatim otherwise)

**What:** `lib/site-url.ts` adds `siteUrl()` — the rebuild's answer to
Bubble's "Website home URL" token: `NEXT_PUBLIC_SITE_URL` →
`VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` (https-prefixed) → request
host → `http://localhost:3000`. The privacy page renders the resolved
URL where the copy said the literal words "Website home URL", and the
"TournamentGuru" brand mentions in privacy/legal body copy are now
links to `siteUrl()` (via `LegalLink` in `LegalArticle.tsx`). These two
substitutions are client-sanctioned; every other word stays verbatim
per S11.1 — don't "fix" the links back to plain text, and don't edit
the strings.

**Why:** the Bubble original inserted the live home URL into the same
sentence; the rebuild had shipped the placeholder words. Env legs
resolve before any `headers()` read, so the legal pages stay statically
rendered whenever the URL is configured (DEPLOYMENT.md §6 now requires
it in prod).

**Alternative rejected:** reusing `siteUrl()` inside the existing
server actions (signup/reset/promo emails). Those resolve
`origin`-header-first by design — a multi-domain deployment keeps the
user on the host they signed up from — so folding them into the
env-first helper would change behavior.
